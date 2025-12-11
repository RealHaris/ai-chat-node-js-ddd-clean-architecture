import { ApplicationError } from '~/shared/infra/error/application';

export class QuotaExceededError<
  TMessage extends string = string,
  TDetails = unknown,
> extends ApplicationError<'QuotaExceededError', TMessage, TDetails> {
  constructor(
    message = 'Monthly quota exceeded. Please subscribe to a bundle or wait for free tier reset.' as TMessage,
    details?: TDetails
  ) {
    super(message, details);
    this.name = 'QuotaExceededError';
  }
}
