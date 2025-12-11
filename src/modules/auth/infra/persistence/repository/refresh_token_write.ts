import { singleton } from 'tsyringe';
import { eq } from 'drizzle-orm';

import { db } from '~/shared/infra/db/config/config';
import { refreshTokens } from '~/shared/infra/db/schemas/refresh_tokens';
import { RefreshToken, NewRefreshToken } from '~/shared/infra/db/types';
import { BaseWriteRepository } from '~/shared/infra/persistence/repository/write';

@singleton()
export class RefreshTokenWriteRepository extends BaseWriteRepository<
  typeof refreshTokens,
  NewRefreshToken
> {
  constructor() {
    super(refreshTokens, db);
  }

  async create(data: NewRefreshToken): Promise<RefreshToken> {
    const result = await this.db.insert(this.table).values(data).returning();

    return result[0];
  }

  async revokeToken(token: string): Promise<void> {
    await this.db
      .update(this.table)
      .set({ isRevoked: true })
      .where(eq(this.table.token, token));
  }

  async revokeAllUserTokens(userId: string): Promise<void> {
    await this.db
      .update(this.table)
      .set({ isRevoked: true })
      .where(eq(this.table.userId, userId));
  }
}
