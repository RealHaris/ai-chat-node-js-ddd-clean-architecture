import { inject, injectable } from 'tsyringe';
import { IUseCase, Result } from 'types-ddd';

import { BundleTierResponseDTO } from '~/modules/bundle-tier/application/dto/dto';
import { BundleTierReadRepository } from '~/modules/bundle-tier/infra/persistence/repository/read';
import { BundleTier } from '~/shared/infra/db/types';

interface GetAllBundleTiersInput {
  includeInactive?: boolean;
}

@injectable()
export class GetAllBundleTiersUseCase implements IUseCase<
  GetAllBundleTiersInput,
  Result<BundleTierResponseDTO[], string>
> {
  constructor(
    @inject(BundleTierReadRepository)
    private bundleTierReadRepository: BundleTierReadRepository
  ) {}

  async execute(
    input: GetAllBundleTiersInput = {}
  ): Promise<Result<BundleTierResponseDTO[], string>> {
    const { includeInactive = false } = input;

    const bundleTiers = includeInactive
      ? await this.bundleTierReadRepository.findAll()
      : await this.bundleTierReadRepository.findActive();

    const response: BundleTierResponseDTO[] = bundleTiers.map(
      (bundleTier: BundleTier) => ({
        id: bundleTier.id,
        name: bundleTier.name,
        maxMessages: bundleTier.maxMessages,
        priceMonthly: bundleTier.priceMonthly,
        priceYearly: bundleTier.priceYearly,
        isActive: bundleTier.isActive,
        isUnlimited: bundleTier.maxMessages === -1,
        createdBy: bundleTier.createdBy,
        createdAt: bundleTier.createdAt,
        updatedAt: bundleTier.updatedAt,
      })
    );

    return Result.Ok(response);
  }
}
