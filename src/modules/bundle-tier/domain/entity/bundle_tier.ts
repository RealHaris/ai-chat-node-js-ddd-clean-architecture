import { Aggregate, Result } from 'types-ddd';

import { BundleTierCreated } from '~/modules/bundle-tier/domain/event/bundle_tier_created';
import { BundleTierUpdated } from '~/modules/bundle-tier/domain/event/bundle_tier_updated';

export interface BundleTierCreationAttributes {
  id?: string;
  name: string;
  maxMessages: number;
  priceMonthly: string;
  priceYearly: string;
  isActive?: boolean;
  createdBy?: string | null;
  createdAt?: Date;
  updatedAt?: Date;
  deletedAt?: Date | null;
}

export class BundleTier extends Aggregate<BundleTierCreationAttributes> {
  private constructor(props: BundleTierCreationAttributes) {
    super(props);
  }

  get name(): string {
    return this.props.name;
  }

  get maxMessages(): number {
    return this.props.maxMessages;
  }

  get priceMonthly(): string {
    return this.props.priceMonthly;
  }

  get priceYearly(): string {
    return this.props.priceYearly;
  }

  get isActive(): boolean {
    return this.props.isActive ?? true;
  }

  get createdBy(): string | null | undefined {
    return this.props.createdBy;
  }

  get isUnlimited(): boolean {
    return this.props.maxMessages === -1;
  }

  static create(props: BundleTierCreationAttributes): Result<BundleTier> {
    // Validate maxMessages
    if (props.maxMessages < -1) {
      return Result.fail(
        'maxMessages must be -1 (unlimited) or a positive integer'
      );
    }

    if (props.maxMessages !== -1 && props.maxMessages < 1) {
      return Result.fail('maxMessages must be at least 1 or -1 for unlimited');
    }

    // Validate prices
    const monthlyPrice = parseFloat(props.priceMonthly);
    const yearlyPrice = parseFloat(props.priceYearly);

    if (isNaN(monthlyPrice) || monthlyPrice < 0) {
      return Result.fail('priceMonthly must be a valid non-negative number');
    }

    if (isNaN(yearlyPrice) || yearlyPrice < 0) {
      return Result.fail('priceYearly must be a valid non-negative number');
    }

    const bundleTier = new BundleTier({
      ...props,
      isActive: props.isActive ?? true,
    });

    const bundleTierCreated = new BundleTierCreated();
    bundleTier.addEvent(bundleTierCreated);

    return Result.Ok(bundleTier);
  }

  update(props: Partial<BundleTierCreationAttributes>): Result<BundleTier> {
    // Validate maxMessages if provided
    if (props.maxMessages !== undefined) {
      if (props.maxMessages < -1) {
        return Result.fail(
          'maxMessages must be -1 (unlimited) or a positive integer'
        );
      }
      if (props.maxMessages !== -1 && props.maxMessages < 1) {
        return Result.fail(
          'maxMessages must be at least 1 or -1 for unlimited'
        );
      }
    }

    // Validate prices if provided
    if (props.priceMonthly !== undefined) {
      const monthlyPrice = parseFloat(props.priceMonthly);
      if (isNaN(monthlyPrice) || monthlyPrice < 0) {
        return Result.fail('priceMonthly must be a valid non-negative number');
      }
    }

    if (props.priceYearly !== undefined) {
      const yearlyPrice = parseFloat(props.priceYearly);
      if (isNaN(yearlyPrice) || yearlyPrice < 0) {
        return Result.fail('priceYearly must be a valid non-negative number');
      }
    }

    // Update properties
    if (props.name !== undefined) this.props.name = props.name;
    if (props.maxMessages !== undefined)
      this.props.maxMessages = props.maxMessages;
    if (props.priceMonthly !== undefined)
      this.props.priceMonthly = props.priceMonthly;
    if (props.priceYearly !== undefined)
      this.props.priceYearly = props.priceYearly;
    if (props.isActive !== undefined) this.props.isActive = props.isActive;

    this.props.updatedAt = new Date();

    const bundleTierUpdated = new BundleTierUpdated();
    this.addEvent(bundleTierUpdated);

    return Result.Ok(this);
  }

  softDelete(): void {
    this.props.deletedAt = new Date();
    this.props.isActive = false;
    this.props.updatedAt = new Date();
  }
}
