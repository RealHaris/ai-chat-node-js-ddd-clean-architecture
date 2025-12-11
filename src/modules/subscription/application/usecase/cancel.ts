import { inject, injectable } from 'tsyringe';
import { IUseCase, Result } from 'types-ddd';
import { fromZodError } from 'zod-validation-error';

import {
  CancelSubscriptionDTO,
  CancelSubscriptionDTOSchema,
} from '~/modules/subscription/application/dto/dto';
import { Subscription } from '~/modules/subscription/domain/entity/subscription';
import { SubscriptionCancelled } from '~/modules/subscription/domain/event/subscription_cancelled';
import { SubscriptionReadRepository } from '~/modules/subscription/infra/persistence/repository/read';
import { SubscriptionWriteRepository } from '~/modules/subscription/infra/persistence/repository/write';
import { ForbiddenError, NotFoundError } from '~/shared/infra/error';

interface CancelSubscriptionInput {
  userId: string;
  data: CancelSubscriptionDTO;
}

interface CancelSubscriptionResponse {
  message: string;
  subscriptionId: string;
}

@injectable()
export class CancelSubscriptionUseCase implements IUseCase<
  CancelSubscriptionInput,
  Result<CancelSubscriptionResponse, string>
> {
  constructor(
    @inject(SubscriptionReadRepository)
    private subscriptionReadRepository: SubscriptionReadRepository,
    @inject(SubscriptionWriteRepository)
    private subscriptionWriteRepository: SubscriptionWriteRepository
  ) {}

  async execute(
    input: CancelSubscriptionInput
  ): Promise<Result<CancelSubscriptionResponse, string>> {
    const { userId, data } = input;

    // Validate input
    const schema = CancelSubscriptionDTOSchema.safeParse(data);

    if (!schema.success) {
      const validationError = fromZodError(schema.error);
      return Result.fail(validationError.toString());
    }

    // Find subscription
    const existingSubscription = await this.subscriptionReadRepository.findById(
      data.subscriptionId
    );

    if (!existingSubscription) {
      throw new NotFoundError(
        `Subscription with id ${data.subscriptionId} not found`
      );
    }

    // Check ownership
    if (existingSubscription.userId !== userId) {
      throw new ForbiddenError(
        'You do not have permission to cancel this subscription'
      );
    }

    // Check if already cancelled
    if (existingSubscription.cancelledAt) {
      return Result.fail('This subscription has already been cancelled');
    }

    // Create subscription entity
    const subscriptionResult = Subscription.create({
      id: existingSubscription.id,
      userId: existingSubscription.userId,
      bundleTierId: existingSubscription.bundleTierId,
      bundleName: existingSubscription.bundleName,
      bundleMaxMessages: existingSubscription.bundleMaxMessages,
      bundlePrice: existingSubscription.bundlePrice,
      billingCycle: existingSubscription.billingCycle as 'monthly' | 'yearly',
      autoRenewal: existingSubscription.autoRenewal,
      status: existingSubscription.status,
      startDate: existingSubscription.startDate,
      endDate: existingSubscription.endDate,
      renewalDate: existingSubscription.renewalDate,
      cancelledAt: existingSubscription.cancelledAt,
      createdAt: existingSubscription.createdAt,
      updatedAt: existingSubscription.updatedAt,
    });

    if (subscriptionResult.isFail()) {
      return Result.fail(subscriptionResult.error());
    }

    const subscription = subscriptionResult.value();

    // Cancel the subscription
    subscription.cancel();

    // Add cancellation event
    const subscriptionCancelled = new SubscriptionCancelled();
    subscription.addEvent(subscriptionCancelled);
    subscription.dispatchEvent(SubscriptionCancelled.NAME);

    // Update in database
    await this.subscriptionWriteRepository.cancel(data.subscriptionId);

    return Result.Ok({
      message: `Subscription "${existingSubscription.bundleName}" has been cancelled`,
      subscriptionId: data.subscriptionId,
    });
  }
}
