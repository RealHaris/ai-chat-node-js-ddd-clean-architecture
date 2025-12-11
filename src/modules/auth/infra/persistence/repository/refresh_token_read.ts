import { singleton } from 'tsyringe';
import { eq, and, gt } from 'drizzle-orm';

import { db } from '~/shared/infra/db/config/config';
import { refreshTokens } from '~/shared/infra/db/schemas/refresh_tokens';
import { RefreshToken } from '~/shared/infra/db/types';
import { BaseReadRepository } from '~/shared/infra/persistence/repository/read';

@singleton()
export class RefreshTokenReadRepository extends BaseReadRepository<
  typeof refreshTokens
> {
  constructor() {
    super(refreshTokens, db);
  }

  async findValidToken(token: string): Promise<RefreshToken | null> {
    const result = await this.db
      .select()
      .from(this.table)
      .where(
        and(
          eq(this.table.token, token),
          eq(this.table.isRevoked, false),
          gt(this.table.expiresAt, new Date())
        )
      )
      .limit(1);

    return result[0] || null;
  }

  async findByUserId(userId: string): Promise<RefreshToken[]> {
    return this.db
      .select()
      .from(this.table)
      .where(
        and(eq(this.table.userId, userId), eq(this.table.isRevoked, false))
      );
  }
}
