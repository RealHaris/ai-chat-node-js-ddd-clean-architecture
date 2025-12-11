import { inject, injectable } from 'tsyringe';
import { IUseCase, Result } from 'types-ddd';
import { fromZodError } from 'zod-validation-error';

import {
  CreateBundleTierDTO,
  CreateBundleTierDTOSchema,
  BundleTierResponseDTO,
} from '~/modules/bundle-tier/application/dto/dto';
import { BundleTier } from '~/modules/bundle-tier/domain/entity/bundle_tier';
import { BundleTierCreated } from '~/modules/bundle-tier/domain/event/bundle_tier_created';
import { BundleTierReadRepository } from '~/modules/bundle-tier/infra/persistence/repository/read';
import { BundleTierWriteRepository } from '~/modules/bundle-tier/infra/persistence/repository/write';
import { ValidationError } from '~/shared/infra/error';

@injectable()
export class CreateBundleTierUseCase implements IUseCase<
  CreateBundleTierDTO,
  Result<BundleTierResponseDTO, string>
> {
  constructor(
    @inject(BundleTierReadRepository)
    private bundleTierReadRepository: BundleTierReadRepository,
    @inject(BundleTierWriteRepository)
    private bundleTierWriteRepository: BundleTierWriteRepository
  ) {}

  async execute(
    dto: CreateBundleTierDTO,
    createdBy?: string
  ): Promise<Result<BundleTierResponseDTO, string>> {
    // Validate input
    const schema = CreateBundleTierDTOSchema.safeParse(dto);

    if (!schema.success) {
      const validationError = fromZodError(schema.error);
      return Result.fail(validationError.toString());
    }

    // Check if bundle tier with the same name already exists
    const existingBundleTier = await this.bundleTierReadRepository.findByName(
      dto.name
    );

    if (existingBundleTier) {
      throw new ValidationError(
        'duplicate_bundle_tier',
        'A bundle tier with that name already exists'
      );
    }

    // Create bundle tier entity
    const bundleTierResult = BundleTier.create({
      name: dto.name,
      maxMessages: dto.maxMessages,
      priceMonthly: dto.priceMonthly,
      priceYearly: dto.priceYearly,
      isActive: dto.isActive ?? true,
      createdBy: createdBy || null,
    });

    if (bundleTierResult.isFail()) {
      return Result.fail(bundleTierResult.error());
    }

    const bundleTier = bundleTierResult.value();

    // Dispatch event
    bundleTier.dispatchEvent(BundleTierCreated.NAME);

    // Save to database
    const createdBundleTier =
      await this.bundleTierWriteRepository.save(bundleTier);

    // Return response DTO
    const response: BundleTierResponseDTO = {
      id: createdBundleTier.id,
      name: createdBundleTier.name,
      maxMessages: createdBundleTier.maxMessages,
      priceMonthly: createdBundleTier.priceMonthly,
      priceYearly: createdBundleTier.priceYearly,
      isActive: createdBundleTier.isActive,
      isUnlimited: createdBundleTier.maxMessages === -1,
      createdBy: createdBundleTier.createdBy,
      createdAt: createdBundleTier.createdAt,
      updatedAt: createdBundleTier.updatedAt,
    };

    return Result.Ok(response);
  }
}
