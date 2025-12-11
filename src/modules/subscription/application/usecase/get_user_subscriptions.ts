import { inject, injectable } from 'tsyringe';
import { IUseCase, Result } from 'types-ddd';

import { SubscriptionResponseDTO } from '~/modules/subscription/application/dto/dto';
import { SubscriptionReadRepository } from '~/modules/subscription/infra/persistence/repository/read';
import { Subscription } from '~/shared/infra/db/types';

interface GetUserSubscriptionsInput {
  userId: string;
  activeOnly?: boolean;
}

@injectable()
export class GetUserSubscriptionsUseCase implements IUseCase<
  GetUserSubscriptionsInput,
  Result<SubscriptionResponseDTO[], string>
> {
  constructor(
    @inject(SubscriptionReadRepository)
    private subscriptionReadRepository: SubscriptionReadRepository
  ) {}

  async execute(
    input: GetUserSubscriptionsInput
  ): Promise<Result<SubscriptionResponseDTO[], string>> {
    const { userId, activeOnly = false } = input;

    const subscriptions = activeOnly
      ? await this.subscriptionReadRepository.findActiveByUserId(userId)
      : await this.subscriptionReadRepository.findByUserId(userId);

    const response: SubscriptionResponseDTO[] = subscriptions.map(
      (subscription: Subscription) => ({
        id: subscription.id,
        userId: subscription.userId,
        bundleTierId: subscription.bundleTierId,
        bundleName: subscription.bundleName,
        bundleMaxMessages: subscription.bundleMaxMessages,
        bundlePrice: subscription.bundlePrice,
        billingCycle: subscription.billingCycle as 'monthly' | 'yearly',
        autoRenewal: subscription.autoRenewal,
        status: subscription.status,
        isActive:
          subscription.status &&
          !subscription.cancelledAt &&
          new Date() < subscription.endDate,
        isUnlimited: subscription.bundleMaxMessages === -1,
        startDate: subscription.startDate,
        endDate: subscription.endDate,
        renewalDate: subscription.renewalDate,
        cancelledAt: subscription.cancelledAt,
        createdAt: subscription.createdAt,
        updatedAt: subscription.updatedAt,
      })
    );

    return Result.Ok(response);
  }
}
