import { inject, injectable } from 'tsyringe';
import { IUseCase, Result } from 'types-ddd';

import { BundleTierReadRepository } from '~/modules/bundle-tier/infra/persistence/repository/read';
import { BundleTierWriteRepository } from '~/modules/bundle-tier/infra/persistence/repository/write';
import { NotFoundError } from '~/shared/infra/error';

interface DeleteBundleTierInput {
  id: string;
}

interface DeleteBundleTierResponse {
  message: string;
}

@injectable()
export class DeleteBundleTierUseCase implements IUseCase<
  DeleteBundleTierInput,
  Result<DeleteBundleTierResponse, string>
> {
  constructor(
    @inject(BundleTierReadRepository)
    private bundleTierReadRepository: BundleTierReadRepository,
    @inject(BundleTierWriteRepository)
    private bundleTierWriteRepository: BundleTierWriteRepository
  ) {}

  async execute(
    input: DeleteBundleTierInput
  ): Promise<Result<DeleteBundleTierResponse, string>> {
    const { id } = input;

    // Find existing bundle tier
    const existingBundleTier = await this.bundleTierReadRepository.getAny(id);

    if (!existingBundleTier) {
      throw new NotFoundError(`Bundle tier with id ${id} not found`);
    }

    // Soft delete by setting deletedAt and isActive = false
    await this.bundleTierWriteRepository.softDelete(id);

    return Result.Ok({
      message: `Bundle tier "${existingBundleTier.name}" has been deleted`,
    });
  }
}
