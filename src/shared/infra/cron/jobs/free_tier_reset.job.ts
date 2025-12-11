import cron, { ScheduledTask } from 'node-cron';
import { eq } from 'drizzle-orm';

import { db } from '~/shared/infra/db/config/config';
import { users } from '~/shared/infra/db/schemas/users';
import { useLogger } from '~/shared/packages/logger/logger';

const logger = useLogger('FreeTierResetJob');

const FREE_TIER_MONTHLY_MESSAGES = 3;

/**
 * Resets the totalRemainingMessages for all free tier users to 3.
 * This runs on the 1st of each month at midnight (00:00).
 */
async function resetFreeTierQuotas(): Promise<void> {
  logger.log('Starting free tier quota reset...');

  try {
    // Update all free tier users: reset totalRemainingMessages to 3
    const result = await db
      .update(users)
      .set({
        totalRemainingMessages: FREE_TIER_MONTHLY_MESSAGES,
        latestBundleRemainingQuota: FREE_TIER_MONTHLY_MESSAGES,
        updatedAt: new Date(),
      })
      .where(eq(users.isFreeTier, true))
      .returning({ id: users.id });

    logger.log(
      `Successfully reset quotas for ${result.length} free tier users`
    );
  } catch (error) {
    logger.error('Failed to reset free tier quotas', error);
    throw error;
  }
}

/**
 * Starts the free tier reset cron job.
 * Schedule: 1st of every month at 00:00 (midnight)
 * Cron expression: '0 0 1 * *'
 */
export function startFreeTierResetJob(): ScheduledTask {
  // Cron expression: minute hour day-of-month month day-of-week
  // '0 0 1 * *' = At 00:00 on day-of-month 1
  const task = cron.schedule('0 0 1 * *', async () => {
    logger.log('Free tier reset cron job triggered');
    await resetFreeTierQuotas();
  });

  logger.log(
    'Free tier reset cron job scheduled (runs 1st of each month at 00:00 UTC)'
  );

  return task;
}

/**
 * Manually trigger the free tier reset (useful for testing or admin actions).
 */
export async function manualFreeTierReset(): Promise<void> {
  logger.log('Manual free tier reset triggered');
  await resetFreeTierQuotas();
}

export default startFreeTierResetJob;
