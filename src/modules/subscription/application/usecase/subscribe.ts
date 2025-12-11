import { inject, injectable } from 'tsyringe';
import { IUseCase, Result } from 'types-ddd';
import { fromZodError } from 'zod-validation-error';

import { BundleTierReadRepository } from '~/modules/bundle-tier/infra/persistence/repository/read';
import {
  SubscribeDTO,
  SubscribeDTOSchema,
  SubscriptionResponseDTO,
} from '~/modules/subscription/application/dto/dto';
import { QuotaService } from '~/modules/subscription/application/service/quota.service';
import { Subscription } from '~/modules/subscription/domain/entity/subscription';
import { SubscriptionCreated } from '~/modules/subscription/domain/event/subscription_created';
import { BillingCycle } from '~/modules/subscription/domain/interface/subscription';
import { SubscriptionReadRepository } from '~/modules/subscription/infra/persistence/repository/read';
import { SubscriptionWriteRepository } from '~/modules/subscription/infra/persistence/repository/write';
import { NotFoundError, ValidationError } from '~/shared/infra/error';
import { Subscription as SubscriptionDBType } from '~/shared/infra/db/types';
import { subscriptionExpiryQueue } from '~/shared/infra/queue';
import { SubscriptionExpiryJobData } from '~/shared/infra/queue/workers/subscription_expiry.worker';
import { useLogger } from '~/shared/packages/logger/logger';

const logger = useLogger('SubscribeUseCase');

interface SubscribeInput {
  userId: string;
  data: SubscribeDTO;
}

@injectable()
export class SubscribeUseCase implements IUseCase<
  SubscribeInput,
  Result<SubscriptionResponseDTO, string>
> {
  constructor(
    @inject(BundleTierReadRepository)
    private bundleTierReadRepository: BundleTierReadRepository,
    @inject(SubscriptionReadRepository)
    private subscriptionReadRepository: SubscriptionReadRepository,
    @inject(SubscriptionWriteRepository)
    private subscriptionWriteRepository: SubscriptionWriteRepository,
    @inject(QuotaService)
    private quotaService: QuotaService
  ) {}

  async execute(
    input: SubscribeInput
  ): Promise<Result<SubscriptionResponseDTO, string>> {
    const { userId, data } = input;

    // Validate input
    const schema = SubscribeDTOSchema.safeParse(data);

    if (!schema.success) {
      const validationError = fromZodError(schema.error);
      return Result.fail(validationError.toString());
    }

    // Get bundle tier
    const bundleTier = await this.bundleTierReadRepository.getAny(
      data.bundleTierId
    );

    if (!bundleTier) {
      throw new NotFoundError(
        `Bundle tier with id ${data.bundleTierId} not found`
      );
    }

    if (!bundleTier.isActive) {
      throw new ValidationError(
        'inactive_bundle_tier',
        'This bundle tier is no longer available'
      );
    }

    // Check if user already has an active subscription for this bundle
    const existingSubscription =
      await this.subscriptionReadRepository.findActiveByUserIdAndBundleId(
        userId,
        data.bundleTierId
      );

    if (existingSubscription) {
      throw new ValidationError(
        'duplicate_subscription',
        'You already have an active subscription for this bundle tier'
      );
    }

    // Calculate dates
    const startDate = new Date();
    const endDate = this.calculateEndDate(startDate, data.billingCycle);
    const renewalDate = new Date(endDate);

    // Get price based on billing cycle
    const price =
      data.billingCycle === 'monthly'
        ? bundleTier.priceMonthly
        : bundleTier.priceYearly;

    // Create subscription entity
    const subscriptionResult = Subscription.create({
      userId,
      bundleTierId: data.bundleTierId,
      bundleName: bundleTier.name,
      bundleMaxMessages: bundleTier.maxMessages,
      bundlePrice: price,
      billingCycle: data.billingCycle as BillingCycle,
      autoRenewal: true,
      status: true,
      startDate,
      endDate,
      renewalDate,
    });

    if (subscriptionResult.isFail()) {
      return Result.fail(subscriptionResult.error());
    }

    const subscription = subscriptionResult.value();

    // Dispatch event
    subscription.dispatchEvent(SubscriptionCreated.NAME);

    // Save subscription
    const createdSubscription =
      await this.subscriptionWriteRepository.save(subscription);

    // Add quota to user
    await this.quotaService.addQuota(
      userId,
      createdSubscription.id,
      bundleTier.name,
      bundleTier.maxMessages
    );

    // Schedule subscription expiry job
    await this.scheduleExpiryJob(createdSubscription, endDate);

    // Return response
    const response: SubscriptionResponseDTO = {
      id: createdSubscription.id,
      userId: createdSubscription.userId,
      bundleTierId: createdSubscription.bundleTierId,
      bundleName: createdSubscription.bundleName,
      bundleMaxMessages: createdSubscription.bundleMaxMessages,
      bundlePrice: createdSubscription.bundlePrice,
      billingCycle: createdSubscription.billingCycle as 'monthly' | 'yearly',
      autoRenewal: createdSubscription.autoRenewal,
      status: createdSubscription.status,
      isActive: createdSubscription.status && !createdSubscription.cancelledAt,
      isUnlimited: createdSubscription.bundleMaxMessages === -1,
      startDate: createdSubscription.startDate,
      endDate: createdSubscription.endDate,
      renewalDate: createdSubscription.renewalDate,
      cancelledAt: createdSubscription.cancelledAt,
      createdAt: createdSubscription.createdAt,
      updatedAt: createdSubscription.updatedAt,
    };

    return Result.Ok(response);
  }

  private calculateEndDate(startDate: Date, billingCycle: string): Date {
    const endDate = new Date(startDate);

    if (billingCycle === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    return endDate;
  }

  /**
   * Schedule a delayed job for the subscription expiry date.
   * When the job runs, it will either attempt renewal (if autoRenewal=true)
   * or shift the user to free tier.
   */
  private async scheduleExpiryJob(
    subscription: SubscriptionDBType,
    endDate: Date
  ): Promise<void> {
    const now = new Date();
    const delay = Math.max(endDate.getTime() - now.getTime(), 0);

    const jobData: SubscriptionExpiryJobData = {
      subscriptionId: subscription.id,
      userId: subscription.userId,
      bundleName: subscription.bundleName,
      bundleMaxMessages: subscription.bundleMaxMessages,
      bundlePrice: subscription.bundlePrice,
      billingCycle: subscription.billingCycle as 'monthly' | 'yearly',
    };

    await subscriptionExpiryQueue.add(`expiry-${subscription.id}`, jobData, {
      delay,
      jobId: `expiry-${subscription.id}-${endDate.getTime()}`,
    });

    logger.log(`Scheduled expiry job for subscription ${subscription.id}`, {
      endDate,
      delayMs: delay,
      delayDays: Math.round(delay / (1000 * 60 * 60 * 24)),
    });
  }
}
