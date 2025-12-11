import { EventHandler } from 'types-ddd';

import { Subscription } from '~/modules/subscription/domain/entity/subscription';

export class SubscriptionCreated extends EventHandler<Subscription> {
  static readonly NAME = 'subscription_created';
  $names = SubscriptionCreated.NAME;
  $version = 0;

  constructor() {
    super({
      eventName: SubscriptionCreated.NAME,
    });
  }

  async dispatch(aggregate: Subscription) {
    const model = aggregate.toObject();
    console.log('Subscription Created', model);
  }
}
