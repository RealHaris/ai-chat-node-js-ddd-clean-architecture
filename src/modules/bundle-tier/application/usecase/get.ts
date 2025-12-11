import { inject, injectable } from 'tsyringe';
import { IUseCase, Result } from 'types-ddd';

import { BundleTierResponseDTO } from '~/modules/bundle-tier/application/dto/dto';
import { BundleTierReadRepository } from '~/modules/bundle-tier/infra/persistence/repository/read';
import { NotFoundError } from '~/shared/infra/error';

interface GetBundleTierInput {
  id: string;
}

@injectable()
export class GetBundleTierUseCase implements IUseCase<
  GetBundleTierInput,
  Result<BundleTierResponseDTO, string>
> {
  constructor(
    @inject(BundleTierReadRepository)
    private bundleTierReadRepository: BundleTierReadRepository
  ) {}

  async execute(
    input: GetBundleTierInput
  ): Promise<Result<BundleTierResponseDTO, string>> {
    const { id } = input;

    const bundleTier = await this.bundleTierReadRepository.getAny(id);

    if (!bundleTier) {
      throw new NotFoundError(`Bundle tier with id ${id} not found`);
    }

    const response: BundleTierResponseDTO = {
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
    };

    return Result.Ok(response);
  }
}
