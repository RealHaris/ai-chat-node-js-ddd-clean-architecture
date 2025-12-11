import { Aggregate, Result } from 'types-ddd';

import { SubscriptionCreated } from '~/modules/subscription/domain/event/subscription_created';
import { BillingCycle } from '~/modules/subscription/domain/interface/subscription';

export interface SubscriptionCreationAttributes {
  id?: string;
  userId: string;
  bundleTierId: string;
  bundleName: string;
  bundleMaxMessages: number;
  bundlePrice: string;
  billingCycle: BillingCycle;
  autoRenewal?: boolean;
  status?: boolean;
  startDate: Date;
  endDate: Date;
  renewalDate: Date;
  cancelledAt?: Date | null;
  createdAt?: Date;
  updatedAt?: Date;
}

export class Subscription extends Aggregate<SubscriptionCreationAttributes> {
  private constructor(props: SubscriptionCreationAttributes) {
    super(props);
  }

  get userId(): string {
    return this.props.userId;
  }

  get bundleTierId(): string {
    return this.props.bundleTierId;
  }

  get bundleName(): string {
    return this.props.bundleName;
  }

  get bundleMaxMessages(): number {
    return this.props.bundleMaxMessages;
  }

  get bundlePrice(): string {
    return this.props.bundlePrice;
  }

  get billingCycle(): BillingCycle {
    return this.props.billingCycle;
  }

  get autoRenewal(): boolean {
    return this.props.autoRenewal ?? true;
  }

  get status(): boolean {
    return this.props.status ?? true;
  }

  get isActive(): boolean {
    return (
      this.status && !this.props.cancelledAt && new Date() < this.props.endDate
    );
  }

  get startDate(): Date {
    return this.props.startDate;
  }

  get endDate(): Date {
    return this.props.endDate;
  }

  get renewalDate(): Date {
    return this.props.renewalDate;
  }

  get cancelledAt(): Date | null | undefined {
    return this.props.cancelledAt;
  }

  get isUnlimited(): boolean {
    return this.props.bundleMaxMessages === -1;
  }

  static create(props: SubscriptionCreationAttributes): Result<Subscription> {
    // Validate dates
    if (props.endDate <= props.startDate) {
      return Result.fail('End date must be after start date');
    }

    const subscription = new Subscription({
      ...props,
      autoRenewal: props.autoRenewal ?? true,
      status: props.status ?? true,
    });

    const subscriptionCreated = new SubscriptionCreated();
    subscription.addEvent(subscriptionCreated);

    return Result.Ok(subscription);
  }

  cancel(): void {
    this.props.cancelledAt = new Date();
    this.props.status = false;
    this.props.autoRenewal = false;
    this.props.updatedAt = new Date();
  }

  toggleAutoRenewal(): boolean {
    this.props.autoRenewal = !this.props.autoRenewal;
    this.props.updatedAt = new Date();
    return this.props.autoRenewal;
  }

  renew(newEndDate: Date, newRenewalDate: Date): void {
    this.props.endDate = newEndDate;
    this.props.renewalDate = newRenewalDate;
    this.props.updatedAt = new Date();
  }

  deactivate(): void {
    this.props.status = false;
    this.props.updatedAt = new Date();
  }
}
