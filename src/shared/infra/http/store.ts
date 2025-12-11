import { AsyncLocalStorage } from 'async_hooks';

export interface IStore {
  method: string;
  url: string;

  // keep-sorted start
  admin?: any;
  customer?: any;
  user?: any;
}

const storage = new AsyncLocalStorage<IStore>();

export const asyncLocalStorage = {
  async run(store: IStore, cb: () => Promise<void>) {
    return storage.run(store, cb);
  },

  get() {
    return storage.getStore();
  },
};
