import { EventHandler } from 'types-ddd';

import { BundleTier } from '~/modules/bundle-tier/domain/entity/bundle_tier';

export class BundleTierCreated extends EventHandler<BundleTier> {
  static readonly NAME = 'bundle_tier_created';
  $names = BundleTierCreated.NAME;
  $version = 0;

  constructor() {
    super({
      eventName: BundleTierCreated.NAME,
    });
  }

  async dispatch(aggregate: BundleTier) {
    const model = aggregate.toObject();
    console.log('Bundle Tier Created', model);
  }
}
