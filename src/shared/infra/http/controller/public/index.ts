import express from 'express';

import v1Router from '~/shared/infra/http/controller/public/v1';

const router = express.Router();

router.use('/public/v1', v1Router);

export default router;
