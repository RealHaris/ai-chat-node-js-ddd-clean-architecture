import { inject, injectable } from 'tsyringe';
import { IUseCase, Result } from 'types-ddd';
import { fromZodError } from 'zod-validation-error';

import {
  UpdateBundleTierDTO,
  UpdateBundleTierDTOSchema,
  BundleTierResponseDTO,
} from '~/modules/bundle-tier/application/dto/dto';
import { BundleTier } from '~/modules/bundle-tier/domain/entity/bundle_tier';
import { BundleTierUpdated } from '~/modules/bundle-tier/domain/event/bundle_tier_updated';
import { BundleTierReadRepository } from '~/modules/bundle-tier/infra/persistence/repository/read';
import { BundleTierWriteRepository } from '~/modules/bundle-tier/infra/persistence/repository/write';
import { NotFoundError, ValidationError } from '~/shared/infra/error';

interface UpdateBundleTierInput {
  id: string;
  data: UpdateBundleTierDTO;
}

@injectable()
export class UpdateBundleTierUseCase implements IUseCase<
  UpdateBundleTierInput,
  Result<BundleTierResponseDTO, string>
> {
  constructor(
    @inject(BundleTierReadRepository)
    private bundleTierReadRepository: BundleTierReadRepository,
    @inject(BundleTierWriteRepository)
    private bundleTierWriteRepository: BundleTierWriteRepository
  ) {}

  async execute(
    input: UpdateBundleTierInput
  ): Promise<Result<BundleTierResponseDTO, string>> {
    const { id, data } = input;

    // Validate input
    const schema = UpdateBundleTierDTOSchema.safeParse(data);

    if (!schema.success) {
      const validationError = fromZodError(schema.error);
      return Result.fail(validationError.toString());
    }

    // Find existing bundle tier
    const existingBundleTier = await this.bundleTierReadRepository.getAny(id);

    if (!existingBundleTier) {
      throw new NotFoundError(`Bundle tier with id ${id} not found`);
    }

    // Check for name uniqueness if name is being updated
    if (data.name && data.name !== existingBundleTier.name) {
      const bundleTierWithSameName =
        await this.bundleTierReadRepository.findByName(data.name);

      if (bundleTierWithSameName) {
        throw new ValidationError(
          'duplicate_bundle_tier',
          'A bundle tier with that name already exists'
        );
      }
    }

    // Create bundle tier entity from existing data
    const bundleTierResult = BundleTier.create({
      id: existingBundleTier.id,
      name: existingBundleTier.name,
      maxMessages: existingBundleTier.maxMessages,
      priceMonthly: existingBundleTier.priceMonthly,
      priceYearly: existingBundleTier.priceYearly,
      isActive: existingBundleTier.isActive,
      createdBy: existingBundleTier.createdBy,
      createdAt: existingBundleTier.createdAt,
      updatedAt: existingBundleTier.updatedAt,
      deletedAt: existingBundleTier.deletedAt,
    });

    if (bundleTierResult.isFail()) {
      return Result.fail(bundleTierResult.error());
    }

    const bundleTier = bundleTierResult.value();

    // Update the bundle tier
    const updateResult = bundleTier.update(data);

    if (updateResult.isFail()) {
      return Result.fail(updateResult.error());
    }

    // Dispatch event
    bundleTier.dispatchEvent(BundleTierUpdated.NAME);

    // Save to database
    const updatedBundleTier =
      await this.bundleTierWriteRepository.update(bundleTier);

    // Return response DTO
    const response: BundleTierResponseDTO = {
      id: updatedBundleTier.id,
      name: updatedBundleTier.name,
      maxMessages: updatedBundleTier.maxMessages,
      priceMonthly: updatedBundleTier.priceMonthly,
      priceYearly: updatedBundleTier.priceYearly,
      isActive: updatedBundleTier.isActive,
      isUnlimited: updatedBundleTier.maxMessages === -1,
      createdBy: updatedBundleTier.createdBy,
      createdAt: updatedBundleTier.createdAt,
      updatedAt: updatedBundleTier.updatedAt,
    };

    return Result.Ok(response);
  }
}
