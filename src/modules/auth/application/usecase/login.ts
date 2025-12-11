import { inject, injectable } from 'tsyringe';
import { IUseCase, Result } from 'types-ddd';
import { fromZodError } from 'zod-validation-error';

import { LoginDTO, LoginDTOSchema } from '~/modules/auth/application/dto/dto';
import { PasswordService } from '~/modules/auth/application/service/password.service';
import { RefreshTokenService } from '~/modules/auth/application/service/refresh_token.service';
import {
  TokenService,
  TokenPair,
} from '~/modules/auth/application/service/token.service';
import { UserReadRepository } from '~/modules/user/infra/persistence/repository/read';
import { User as UserModel } from '~/shared/infra/db/types';
import { UnauthorizedError } from '~/shared/infra/error';

export interface LoginResponse {
  user: Omit<UserModel, 'password'>;
  tokens: TokenPair;
}

@injectable()
export class LoginUseCase implements IUseCase<
  LoginDTO,
  Result<LoginResponse, string>
> {
  constructor(
    @inject(UserReadRepository)
    private userReadRepository: UserReadRepository,
    @inject(RefreshTokenService)
    private refreshTokenService: RefreshTokenService,
    @inject(PasswordService)
    private passwordService: PasswordService,
    @inject(TokenService)
    private tokenService: TokenService
  ) {}

  async execute(dto: LoginDTO): Promise<Result<LoginResponse, string>> {
    // Validate input
    const schema = LoginDTOSchema.safeParse(dto);
    if (!schema.success) {
      return Result.fail(fromZodError(schema.error).toString());
    }

    // Find user by email
    const user = await this.userReadRepository.firstAny({
      email: dto.email,
    });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check if user is soft deleted
    if (user.deletedAt) {
      throw new UnauthorizedError('Account has been deactivated');
    }

    // Verify password
    const isPasswordValid = await this.passwordService.compare(
      dto.password,
      user.password
    );

    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Revoke all existing refresh tokens for this user
    await this.refreshTokenService.revokeAllUserTokens(user.id);

    // Generate new tokens
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

    // Remove password from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...userWithoutPassword } = user;

    return Result.Ok({
      user: userWithoutPassword,
      tokens,
    });
  }
}
