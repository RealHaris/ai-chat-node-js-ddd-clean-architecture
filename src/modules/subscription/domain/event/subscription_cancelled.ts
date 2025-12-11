import { EventHandler } from 'types-ddd';

import { Subscription } from '~/modules/subscription/domain/entity/subscription';

export class SubscriptionCancelled extends EventHandler<Subscription> {
  static readonly NAME = 'subscription_cancelled';
  $names = SubscriptionCancelled.NAME;
  $version = 0;

  constructor() {
    super({
      eventName: SubscriptionCancelled.NAME,
    });
  }

  async dispatch(aggregate: Subscription) {
    const model = aggregate.toObject();
    console.log('Subscription Cancelled', model);
  }
}
