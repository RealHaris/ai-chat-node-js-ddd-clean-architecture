import express from 'express';
import { container } from 'tsyringe';

import { CustomerController } from '~/modules/customer/infra/http/controller/controller';
import { UserController } from '~/modules/user/infra/http/controller/controller';

const router = express.Router();

// Resolve routers
const usersRouter = container.resolve(UserController).register();
const customersRouter = container.resolve(CustomerController).register();

// Routes
router.use('/users', usersRouter);
router.use('/customers', customersRouter);

export default router;
