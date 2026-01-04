type Subscriber<T> = {
  push: (value: T) => void;
  close: () => void;
  return: (value?: unknown) => Promise<IteratorResult<T>>;
} & AsyncIterableIterator<T>;

const createSubscriber = <T>(): Subscriber<T> => {
  const queue: T[] = [];
  const resolvers: ((result: IteratorResult<T>) => void)[] = [];
  let closed = false;

  const push = (value: T) => {
    if (closed) return;

    const resolve = resolvers.shift();
    if (resolve) {
      resolve({ value, done: false });
      return;
    }

    queue.push(value);
  };

  const close = () => {
    if (closed) return;
    closed = true;

    while (resolvers.length > 0) {
      const resolve = resolvers.shift();
      if (resolve) {
        resolve({ value: undefined as never, done: true });
      }
    }
  };

  const iterator: AsyncIterableIterator<T> = {
    [Symbol.asyncIterator]() {
      return iterator;
    },
    next() {
      if (queue.length > 0) {
        const value = queue.shift() as T;
        return Promise.resolve({ value, done: false });
      }

      if (closed) {
        return Promise.resolve({ value: undefined as never, done: true });
      }

      return new Promise((resolve) => {
        resolvers.push(resolve);
      });
    },
    return() {
      close();
      return Promise.resolve({ value: undefined as never, done: true });
    },
    throw(err) {
      close();
      return Promise.reject(err);
    },
  };

  return Object.assign(iterator, { push, close }) as Subscriber<T>;
};

const channels = new Map<string, Set<Subscriber<unknown>>>();

const getChannelKey = (topic: string, key: string) => `${topic}:${key}`;

export const pubsub = {
  publish: <T>(topic: string, key: string, payload: T) => {
    const channelKey = getChannelKey(topic, key);
    const subscribers = channels.get(channelKey);
    if (!subscribers) return;

    for (const subscriber of subscribers) {
      (subscriber as Subscriber<T>).push(payload);
    }
  },

  subscribe: <T>(topic: string, key: string): Subscriber<T> => {
    const channelKey = getChannelKey(topic, key);

    const subscriber = createSubscriber<T>();

    const set = channels.get(channelKey) ?? new Set<Subscriber<unknown>>();
    set.add(subscriber as Subscriber<unknown>);
    channels.set(channelKey, set);

    const originalReturn = subscriber.return.bind(subscriber);
    subscriber.return = async () => {
      const subscribers = channels.get(channelKey);
      subscribers?.delete(subscriber as Subscriber<unknown>);
      if (subscribers && subscribers.size === 0) {
        channels.delete(channelKey);
      }

      subscriber.close();
      return await originalReturn();
    };

    return subscriber;
  },
};
