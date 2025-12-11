import { inject, injectable } from 'tsyringe';
import { IUseCase, Result } from 'types-ddd';
import { fromZodError } from 'zod-validation-error';
import { eq } from 'drizzle-orm';

import {
  AdminResetPasswordDTO,
  AdminResetPasswordDTOSchema,
} from '~/modules/auth/application/dto/dto';
import { PasswordService } from '~/modules/auth/application/service/password.service';
import { RefreshTokenService } from '~/modules/auth/application/service/refresh_token.service';
import { UserReadRepository } from '~/modules/user/infra/persistence/repository/read';
import { db } from '~/shared/infra/db/config/config';
import { users } from '~/shared/infra/db/schemas/users';
import { NotFoundError } from '~/shared/infra/error';

export interface ResetPasswordResponse {
  message: string;
}

/**
 * Admin-only use case for resetting a user's password.
 * Does not require the current password - admin can reset any user's password.
 */
@injectable()
export class ResetPasswordUseCase implements IUseCase<
  AdminResetPasswordDTO,
  Result<ResetPasswordResponse, string>
> {
  constructor(
    @inject(UserReadRepository)
    private userReadRepository: UserReadRepository,
    @inject(RefreshTokenService)
    private refreshTokenService: RefreshTokenService,
    @inject(PasswordService)
    private passwordService: PasswordService
  ) {}

  async execute(
    dto: AdminResetPasswordDTO
  ): Promise<Result<ResetPasswordResponse, string>> {
    // Validate input
    const schema = AdminResetPasswordDTOSchema.safeParse(dto);
    if (!schema.success) {
      return Result.fail(fromZodError(schema.error).toString());
    }

    // Get the user
    const user = await this.userReadRepository.getAny(dto.userId);
    if (!user || user.deletedAt) {
      throw new NotFoundError('User not found');
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
    await this.refreshTokenService.revokeAllUserTokens(dto.userId);

    return Result.Ok({
      message: 'Password has been reset successfully. User must login again.',
    });
  }
}
