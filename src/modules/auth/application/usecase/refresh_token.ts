import { inject, injectable } from 'tsyringe';
import { IUseCase, Result } from 'types-ddd';
import { fromZodError } from 'zod-validation-error';

import {
  RefreshTokenDTO,
  RefreshTokenDTOSchema,
} from '~/modules/auth/application/dto/dto';
import {
  TokenService,
  TokenPair,
} from '~/modules/auth/application/service/token.service';
import { RefreshTokenReadRepository } from '~/modules/auth/infra/persistence/repository/refresh_token_read';
import { RefreshTokenWriteRepository } from '~/modules/auth/infra/persistence/repository/refresh_token_write';
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
    @inject(RefreshTokenReadRepository)
    private refreshTokenReadRepository: RefreshTokenReadRepository,
    @inject(RefreshTokenWriteRepository)
    private refreshTokenWriteRepository: RefreshTokenWriteRepository,
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

    // Verify the refresh token
    const tokenPayload = this.tokenService.verifyRefreshToken(dto.refreshToken);
    if (!tokenPayload) {
      throw new UnauthorizedError('Invalid or expired refresh token');
    }

    // Check if token exists in database and is valid
    const storedToken = await this.refreshTokenReadRepository.findValidToken(
      dto.refreshToken
    );

    if (!storedToken) {
      throw new UnauthorizedError('Refresh token has been revoked or expired');
    }

    // Get the user
    const user = await this.userReadRepository.getAny(tokenPayload.userId);
    if (!user || user.deletedAt) {
      throw new UnauthorizedError('User not found or has been deactivated');
    }

    // Revoke the old refresh token
    await this.refreshTokenWriteRepository.revokeToken(dto.refreshToken);

    // Generate new token pair
    const tokens = this.tokenService.generateTokenPair({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Save new refresh token
    await this.refreshTokenWriteRepository.create({
      userId: user.id,
      token: tokens.refreshToken,
      expiresAt: tokens.refreshTokenExpiresAt,
    });

    return Result.Ok({
      tokens,
    });
  }
}
