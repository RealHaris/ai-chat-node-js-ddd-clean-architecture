import { EventHandler } from 'types-ddd';

import { BundleTier } from '~/modules/bundle-tier/domain/entity/bundle_tier';

export class BundleTierUpdated extends EventHandler<BundleTier> {
  static readonly NAME = 'bundle_tier_updated';
  $names = BundleTierUpdated.NAME;
  $version = 0;

  constructor() {
    super({
      eventName: BundleTierUpdated.NAME,
    });
  }

  async dispatch(aggregate: BundleTier) {
    const model = aggregate.toObject();
    console.log('Bundle Tier Updated', model);
  }
}
