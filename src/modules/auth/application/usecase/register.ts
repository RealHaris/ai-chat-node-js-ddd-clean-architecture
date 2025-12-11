import { inject, injectable } from 'tsyringe';
import { IUseCase, Result } from 'types-ddd';
import { fromZodError } from 'zod-validation-error';

import {
  RegisterDTO,
  RegisterDTOSchema,
} from '~/modules/auth/application/dto/dto';
import { PasswordService } from '~/modules/auth/application/service/password.service';
import { RefreshTokenService } from '~/modules/auth/application/service/refresh_token.service';
import {
  TokenService,
  TokenPair,
} from '~/modules/auth/application/service/token.service';
import { User } from '~/modules/user/domain/entity/user';
import { UserReadRepository } from '~/modules/user/infra/persistence/repository/read';
import { UserWriteRepository } from '~/modules/user/infra/persistence/repository/write';
import { User as UserModel } from '~/shared/infra/db/types';
import { ValidationError } from '~/shared/infra/error';

export interface RegisterResponse {
  user: Omit<UserModel, 'password'>;
  tokens: TokenPair;
}

@injectable()
export class RegisterUseCase implements IUseCase<
  RegisterDTO,
  Result<RegisterResponse, string>
> {
  constructor(
    @inject(UserReadRepository)
    private userReadRepository: UserReadRepository,
    @inject(UserWriteRepository)
    private userWriteRepository: UserWriteRepository,
    @inject(RefreshTokenService)
    private refreshTokenService: RefreshTokenService,
    @inject(PasswordService)
    private passwordService: PasswordService,
    @inject(TokenService)
    private tokenService: TokenService
  ) {}

  async execute(dto: RegisterDTO): Promise<Result<RegisterResponse, string>> {
    // Validate input
    const schema = RegisterDTOSchema.safeParse(dto);
    if (!schema.success) {
      return Result.fail(fromZodError(schema.error).toString());
    }

    // Check if user already exists
    const existingUser = await this.userReadRepository.firstAny({
      email: dto.email,
    });

    if (existingUser) {
      throw new ValidationError(
        'email_exists',
        'A user with this email already exists'
      );
    }

    // Hash password
    const hashedPassword = await this.passwordService.hash(dto.password);

    // Create user entity
    const userResult = User.create({
      email: dto.email,
      password: hashedPassword,
      phone: dto.phone,
    });

    if (userResult.isFail()) {
      return Result.fail(userResult.error());
    }

    // Save user (with free tier defaults from schema)
    const createdUser = await this.userWriteRepository.save(userResult.value());

    // Generate tokens
    const tokens = this.tokenService.generateTokenPair({
      userId: createdUser.id,
      email: createdUser.email,
      role: createdUser.role,
    });

    // Store refresh token in Redis
    await this.refreshTokenService.storeToken(tokens.refreshToken, {
      userId: createdUser.id,
      email: createdUser.email,
      role: createdUser.role,
      createdAt: Date.now(),
    });

    // Remove password from response
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { password: _password, ...userWithoutPassword } = createdUser;

    return Result.Ok({
      user: userWithoutPassword,
      tokens,
    });
  }
}
