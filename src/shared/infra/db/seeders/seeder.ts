import 'reflect-metadata';

import { container } from 'tsyringe';

import { PasswordService } from '~/modules/auth/application/service/password.service';
import { BundleTier } from '~/modules/bundle-tier/domain/entity/bundle_tier';
import { BundleTierWriteRepository } from '~/modules/bundle-tier/infra/persistence/repository/write';
import { BundleTierReadRepository } from '~/modules/bundle-tier/infra/persistence/repository/read';
import { User } from '~/modules/user/domain/entity/user';
import { UserWriteRepository } from '~/modules/user/infra/persistence/repository/write';
import { UserReadRepository } from '~/modules/user/infra/persistence/repository/read';

async function seed() {
  console.log('Seeding database...');

  // Seed Admin User
  const passwordService = container.resolve(PasswordService);
  const userWriteRepository = container.resolve(UserWriteRepository);
  const userReadRepository = container.resolve(UserReadRepository);

  // Check if admin user already exists using the read repository
  const adminUser = await userReadRepository.firstAny({
    email: 'admin@test.com',
  });
  const adminUserExists = !!adminUser;

  if (!adminUserExists) {
    const hashedPassword = await passwordService.hash('admin123');
    const userResult = User.create({
      email: 'admin@test.com',
      password: hashedPassword,
      phone: '1234567890',
    });

    if (userResult.isFail()) {
      console.error('Error creating admin user:', userResult.error());
      throw new Error(`Failed to create admin user: ${userResult.error()}`);
    }
    const user = userResult.value();

    await userWriteRepository.save(user);
    console.log('Admin user created successfully.');
  } else {
    console.log('Admin user already exists, skipping creation...');
  }

  // Seed Bundle Tiers
  const bundleTierWriteRepository = container.resolve(
    BundleTierWriteRepository
  );
  const bundleTierReadRepository = container.resolve(BundleTierReadRepository);

  // Create Basic Tier if it doesn't exist
  const existingBasicTier = await bundleTierReadRepository.findByName('Basic');
  if (!existingBasicTier) {
    const basicTierResult = BundleTier.create({
      name: 'Basic',
      maxMessages: 10,
      priceMonthly: '0',
      priceYearly: '0',
    });

    if (basicTierResult.isFail()) {
      console.error('Error creating Basic tier:', basicTierResult.error());
      throw new Error(
        `Failed to create Basic tier: ${basicTierResult.error()}`
      );
    }
    const basicTier = basicTierResult.value();

    await bundleTierWriteRepository.save(basicTier);
    console.log('Basic tier created successfully.');
  } else {
    console.log('Basic tier already exists, skipping creation...');
  }

  // Create Pro Tier if it doesn't exist
  const existingProTier = await bundleTierReadRepository.findByName('Pro');
  if (!existingProTier) {
    const proTierResult = BundleTier.create({
      name: 'Pro',
      maxMessages: 100,
      priceMonthly: '29',
      priceYearly: '290',
    });

    if (proTierResult.isFail()) {
      console.error('Error creating Pro tier:', proTierResult.error());
      throw new Error(`Failed to create Pro tier: ${proTierResult.error()}`);
    }
    const proTier = proTierResult.value();

    await bundleTierWriteRepository.save(proTier);
    console.log('Pro tier created successfully.');
  } else {
    console.log('Pro tier already exists, skipping creation...');
  }

  // Create Enterprise Tier if it doesn't exist
  const existingEnterpriseTier =
    await bundleTierReadRepository.findByName('Enterprise');
  if (!existingEnterpriseTier) {
    const enterpriseTierResult = BundleTier.create({
      name: 'Enterprise',
      maxMessages: -1, // Unlimited
      priceMonthly: '99',
      priceYearly: '990',
    });

    if (enterpriseTierResult.isFail()) {
      console.error(
        'Error creating Enterprise tier:',
        enterpriseTierResult.error()
      );
      throw new Error(
        `Failed to create Enterprise tier: ${enterpriseTierResult.error()}`
      );
    }
    const enterpriseTier = enterpriseTierResult.value();

    await bundleTierWriteRepository.save(enterpriseTier);
    console.log('Enterprise tier created successfully.');
  } else {
    console.log('Enterprise tier already exists, skipping creation...');
  }

  console.log('Seeding complete!');
  process.exit(0);
}

seed().catch(error => {
  console.error('Error seeding database:', error);
  process.exit(1);
});
