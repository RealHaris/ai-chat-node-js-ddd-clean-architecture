import { inject, injectable } from 'tsyringe';
import { IUseCase, Result } from 'types-ddd';
import { fromZodError } from 'zod-validation-error';

import {
  ToggleAutoRenewalDTO,
  ToggleAutoRenewalDTOSchema,
  SubscriptionResponseDTO,
} from '~/modules/subscription/application/dto/dto';
import { SubscriptionReadRepository } from '~/modules/subscription/infra/persistence/repository/read';
import { SubscriptionWriteRepository } from '~/modules/subscription/infra/persistence/repository/write';
import { ForbiddenError, NotFoundError } from '~/shared/infra/error';

interface ToggleAutoRenewalInput {
  userId: string;
  data: ToggleAutoRenewalDTO;
}

@injectable()
export class ToggleAutoRenewalUseCase implements IUseCase<
  ToggleAutoRenewalInput,
  Result<SubscriptionResponseDTO, string>
> {
  constructor(
    @inject(SubscriptionReadRepository)
    private subscriptionReadRepository: SubscriptionReadRepository,
    @inject(SubscriptionWriteRepository)
    private subscriptionWriteRepository: SubscriptionWriteRepository
  ) {}

  async execute(
    input: ToggleAutoRenewalInput
  ): Promise<Result<SubscriptionResponseDTO, string>> {
    const { userId, data } = input;

    // Validate input
    const schema = ToggleAutoRenewalDTOSchema.safeParse(data);

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
        'You do not have permission to modify this subscription'
      );
    }

    // Check if cancelled
    if (existingSubscription.cancelledAt) {
      return Result.fail('Cannot modify a cancelled subscription');
    }

    // Toggle auto renewal
    const newAutoRenewal = !existingSubscription.autoRenewal;

    // Update in database
    const updatedSubscription =
      await this.subscriptionWriteRepository.toggleAutoRenewal(
        data.subscriptionId,
        newAutoRenewal
      );

    // Return response
    const response: SubscriptionResponseDTO = {
      id: updatedSubscription.id,
      userId: updatedSubscription.userId,
      bundleTierId: updatedSubscription.bundleTierId,
      bundleName: updatedSubscription.bundleName,
      bundleMaxMessages: updatedSubscription.bundleMaxMessages,
      bundlePrice: updatedSubscription.bundlePrice,
      billingCycle: updatedSubscription.billingCycle as 'monthly' | 'yearly',
      autoRenewal: updatedSubscription.autoRenewal,
      status: updatedSubscription.status,
      isActive: updatedSubscription.status && !updatedSubscription.cancelledAt,
      isUnlimited: updatedSubscription.bundleMaxMessages === -1,
      startDate: updatedSubscription.startDate,
      endDate: updatedSubscription.endDate,
      renewalDate: updatedSubscription.renewalDate,
      cancelledAt: updatedSubscription.cancelledAt,
      createdAt: updatedSubscription.createdAt,
      updatedAt: updatedSubscription.updatedAt,
    };

    return Result.Ok(response);
  }
}
