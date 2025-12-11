import express from 'express';
import { container } from 'tsyringe';

import { AuthController } from '~/modules/auth/infra/http/controller/controller';
import { BundleTierController } from '~/modules/bundle-tier/infra/http/controller/controller';
import { ChatController } from '~/modules/chat/infra/http/controller/controller';
import { SubscriptionController } from '~/modules/subscription/infra/http/controller/controller';
import { UserController } from '~/modules/user/infra/http/controller/controller';

const router = express.Router();

// Resolve routers
const authRouter = container.resolve(AuthController).register();
const bundleTiersRouter = container.resolve(BundleTierController).register();
const chatRouter = container.resolve(ChatController).register();
const subscriptionsRouter = container
  .resolve(SubscriptionController)
  .register();
const usersRouter = container.resolve(UserController).register();

// Routes
router.use('/auth', authRouter);
router.use('/bundle-tiers', bundleTiersRouter);
router.use('/chat', chatRouter);
router.use('/subscriptions', subscriptionsRouter);
router.use('/users', usersRouter);

export default router;
