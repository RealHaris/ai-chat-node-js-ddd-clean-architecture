import { eq } from 'drizzle-orm';
import { singleton } from 'tsyringe';

import { User as UserEntity } from '~/modules/user/domain/entity/user';
import { IUserWriteRepository } from '~/modules/user/domain/interface/repository';
import { db } from '~/shared/infra/db/config/config';
import { users } from '~/shared/infra/db/schemas/users';
import { User } from '~/shared/infra/db/types';
import { BaseWriteRepository } from '~/shared/infra/persistence/repository/write';

@singleton()
export class UserWriteRepository
  extends BaseWriteRepository<typeof users, User>
  implements IUserWriteRepository
{
  constructor() {
    super(users, db);
  }

  async save(user: UserEntity): Promise<User> {
    const values = user.toObject();

    const result = await this.db
      .insert(users)
      .values({
        email: values.email,
        password: values.password,
        phone: values.phone || null,
      })
      .returning();

    return result[0];
  }

  async updatePhone(userId: string, phone: string | null): Promise<User> {
    const result = await this.db
      .update(users)
      .set({
        phone,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return result[0];
  }

  async softDelete(userId: string): Promise<boolean> {
    const result = await this.db
      .update(users)
      .set({
        deletedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return result.length > 0;
  }

  async updateTotalSpent(userId: string, amount: string): Promise<User> {
    const result = await this.db
      .update(users)
      .set({
        totalSpent: amount,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return result[0];
  }

  async incrementTotalSpent(userId: string, amount: number): Promise<User> {
    // Get current user
    const currentUser = await this.db
      .select()
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!currentUser[0]) {
      throw new Error('User not found');
    }

    const currentSpent = parseFloat(currentUser[0].totalSpent || '0');
    const newTotal = (currentSpent + amount).toFixed(2);

    const result = await this.db
      .update(users)
      .set({
        totalSpent: newTotal,
        updatedAt: new Date(),
      })
      .where(eq(users.id, userId))
      .returning();

    return result[0];
  }
}
