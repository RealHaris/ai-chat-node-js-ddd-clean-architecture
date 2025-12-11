import { inject, injectable } from 'tsyringe';
import { IUseCase, Result } from 'types-ddd';
import { fromZodError } from 'zod-validation-error';

import { LoginDTO, LoginDTOSchema } from '~/modules/auth/application/dto/dto';
import { PasswordService } from '~/modules/auth/application/service/password.service';
import {
  TokenService,
  TokenPair,
} from '~/modules/auth/application/service/token.service';
import { RefreshTokenWriteRepository } from '~/modules/auth/infra/persistence/repository/refresh_token_write';
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
    @inject(RefreshTokenWriteRepository)
    private refreshTokenWriteRepository: RefreshTokenWriteRepository,
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
    await this.refreshTokenWriteRepository.revokeAllUserTokens(user.id);

    // Generate new tokens
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

    // Remove password from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...userWithoutPassword } = user;

    return Result.Ok({
      user: userWithoutPassword,
      tokens,
    });
  }
}
