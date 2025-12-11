import { z } from 'zod';
import express from 'express';

import { removeNulls } from '~/shared/infra/http/utils/base_controller_helper';

export abstract class BaseController {
  abstract register(): express.Router;

  generateResponse<O extends object>(schema: z.ZodType, data: O) {
    return schema.transform(d => removeNulls(d)).parse(data);
  }
}
