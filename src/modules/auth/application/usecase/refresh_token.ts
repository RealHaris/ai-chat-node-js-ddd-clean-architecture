import { inject, injectable } from 'tsyringe';
import { IUseCase, Result } from 'types-ddd';
import { fromZodError } from 'zod-validation-error';

import {
  RefreshTokenDTO,
  RefreshTokenDTOSchema,
} from '~/modules/auth/application/dto/dto';
import { RefreshTokenService } from '~/modules/auth/application/service/refresh_token.service';
import {
  TokenService,
  TokenPair,
} from '~/modules/auth/application/service/token.service';
import { UserReadRepository } from '~/modules/user/infra/persistence/repository/read';
import { UnauthorizedError } from '~/shared/infra/error';

export interface RefreshTokenResponse {
  tokens: TokenPair;
}

@injectable()
export class RefreshTokenUseCase implements IUseCase<
  RefreshTokenDTO,
  Result<RefreshTokenResponse, string>
> {
  constructor(
    @inject(UserReadRepository)
    private userReadRepository: UserReadRepository,
    @inject(RefreshTokenService)
    private refreshTokenService: RefreshTokenService,
    @inject(TokenService)
    private tokenService: TokenService
  ) {}

  async execute(
    dto: RefreshTokenDTO
  ): Promise<Result<RefreshTokenResponse, string>> {
    // Validate input
    const schema = RefreshTokenDTOSchema.safeParse(dto);
    if (!schema.success) {
      return Result.fail(fromZodError(schema.error).toString());
    }

    // Verify the refresh token JWT
    const tokenPayload = this.tokenService.verifyRefreshToken(dto.refreshToken);
    if (!tokenPayload) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // Check if token exists in Redis and is valid
    const isValid = await this.refreshTokenService.isTokenValid(
      dto.refreshToken
    );
    if (!isValid) {
      throw new UnauthorizedError('Refresh token has been revoked or expired');
    }

    // Get the user
    const user = await this.userReadRepository.getAny(tokenPayload.userId);
    if (!user || user.deletedAt) {
      throw new UnauthorizedError('User not found or has been deactivated');
    }

    // Revoke the old refresh token
    await this.refreshTokenService.revokeToken(dto.refreshToken);

    // Generate new token pair
    const tokens = this.tokenService.generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Store new refresh token in Redis
    await this.refreshTokenService.storeToken(tokens.refreshToken, {
      userId: user.id,
      email: user.email,
      role: user.role,
      createdAt: Date.now(),
    });

    return Result.Ok({
      tokens,
    });
  }
}
