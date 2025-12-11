import { inject, injectable } from 'tsyringe';
import { IUseCase, Result } from 'types-ddd';
import { fromZodError } from 'zod-validation-error';
import { eq } from 'drizzle-orm';

import {
  ResetPasswordDTO,
  ResetPasswordDTOSchema,
} from '~/modules/auth/application/dto/dto';
import { PasswordService } from '~/modules/auth/application/service/password.service';
import { RefreshTokenWriteRepository } from '~/modules/auth/infra/persistence/repository/refresh_token_write';
import { UserReadRepository } from '~/modules/user/infra/persistence/repository/read';
import { db } from '~/shared/infra/db/config/config';
import { users } from '~/shared/infra/db/schemas/users';
import { UnauthorizedError, ValidationError } from '~/shared/infra/error';

export interface ResetPasswordResponse {
  message: string;
}

@injectable()
export class ResetPasswordUseCase implements IUseCase<
  ResetPasswordDTO & { userId: string },
  Result<ResetPasswordResponse, string>
> {
  constructor(
    @inject(UserReadRepository)
    private userReadRepository: UserReadRepository,
    @inject(RefreshTokenWriteRepository)
    private refreshTokenWriteRepository: RefreshTokenWriteRepository,
    @inject(PasswordService)
    private passwordService: PasswordService
  ) {}

  async execute(
    dto: ResetPasswordDTO & { userId: string }
  ): Promise<Result<ResetPasswordResponse, string>> {
    // Validate input
    const schema = ResetPasswordDTOSchema.safeParse(dto);
    if (!schema.success) {
      return Result.fail(fromZodError(schema.error).toString());
    }

    // Get the user
    const user = await this.userReadRepository.getAny(dto.userId);
    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await this.passwordService.compare(
      dto.currentPassword,
      user.password
    );

    if (!isCurrentPasswordValid) {
      throw new ValidationError(
        'invalid_password',
        'Current password is incorrect'
      );
    }

    // Check if new password is same as current
    const isSamePassword = await this.passwordService.compare(
      dto.newPassword,
      user.password
    );

    if (isSamePassword) {
      throw new ValidationError(
        'same_password',
        'New password must be different from current password'
      );
    }

    // Hash new password
    const hashedPassword = await this.passwordService.hash(dto.newPassword);

    // Update password
    await db
      .update(users)
      .set({
        password: hashedPassword,
        updatedAt: new Date(),
      })
      .where(eq(users.id, dto.userId));

    // Revoke all refresh tokens for this user (force re-login)
    await this.refreshTokenWriteRepository.revokeAllUserTokens(dto.userId);

    return Result.Ok({
      message: 'Password has been reset successfully. Please login again.',
    });
  }
}
