import { nanoid } from 'nanoid';

type LockRecord = {
  ownerId: string;
  expiresAt: number;
};

const LOCK_TTL_MS = 30_000;
const EXTEND_INTERVAL_MS = 10_000;
const ACQUIRE_DEADLINE_MS = 30_000;
const WAIT_SLICE_MS = 1000;

const locks = new Map<string, LockRecord>();
const waiters = new Map<string, Set<() => void>>();

const notifyWaiters = (waitKey: string) => {
  const set = waiters.get(waitKey);
  if (!set) return;

  for (const resolve of set) {
    resolve();
  }

  waiters.delete(waitKey);
};

const waitForUnlock = (waitKey: string, ms: number) => {
  return new Promise<void>((resolve) => {
    const set = waiters.get(waitKey) ?? new Set<() => void>();

    let done = false;

    const finish = () => {
      if (done) return;
      done = true;

      clearTimeout(timer);
      set.delete(finish);
      if (set.size === 0) {
        waiters.delete(waitKey);
      }

      resolve();
    };

    set.add(finish);
    waiters.set(waitKey, set);

    const timer = setTimeout(finish, ms);
  });
};

export class Lock {
  #id: string;

  #lockKey: string;
  #waitKey: string;

  #acquired = false;
  #timer?: NodeJS.Timeout;
  #controller: AbortController;

  constructor(key: string) {
    this.#id = nanoid();

    this.#lockKey = `lock:${key}`;
    this.#waitKey = `lock:wait:${key}`;

    this.#controller = new AbortController();
  }

  get signal(): AbortSignal {
    return this.#controller.signal;
  }

  async acquire() {
    const deadline = Date.now() + ACQUIRE_DEADLINE_MS;

    while (Date.now() < deadline) {
      const acquired = this.#tryAcquireOnce();
      if (acquired) {
        this.#acquired = true;
        this.#start();
        return true;
      }

      const remaining = deadline - Date.now();
      if (remaining <= 0) {
        break;
      }

      await waitForUnlock(this.#waitKey, Math.min(remaining, WAIT_SLICE_MS));
    }

    return false;
  }

  async tryAcquire() {
    const acquired = this.#tryAcquireOnce();
    if (acquired) {
      this.#acquired = true;
      this.#start();
      return true;
    }

    return false;
  }

  async release() {
    if (!this.#acquired) return false;

    this.#stop();
    this.#controller.abort();

    const record = locks.get(this.#lockKey);

    if (!record || record.ownerId !== this.#id) {
      this.#acquired = false;
      return false;
    }

    locks.delete(this.#lockKey);
    notifyWaiters(this.#waitKey);

    this.#acquired = false;
    return true;
  }

  #tryAcquireOnce() {
    const record = locks.get(this.#lockKey);
    if (record && record.expiresAt <= Date.now()) {
      locks.delete(this.#lockKey);
      notifyWaiters(this.#waitKey);
    }

    if (locks.has(this.#lockKey)) {
      return false;
    }

    locks.set(this.#lockKey, {
      ownerId: this.#id,
      expiresAt: Date.now() + LOCK_TTL_MS,
    });

    return true;
  }

  #start() {
    if (!this.#acquired) return;

    this.#timer = setInterval(async () => {
      try {
        const renewed = await this.#extend();
        if (!renewed) {
          this.#stop();
          this.#acquired = false;
          this.#controller.abort();
        }
      } catch {
        this.#stop();
        this.#acquired = false;
        this.#controller.abort();
      }
    }, EXTEND_INTERVAL_MS);

    this.#timer.unref();
  }

  #stop() {
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = undefined;
    }
  }

  async #extend() {
    if (!this.#acquired) return false;

    const record = locks.get(this.#lockKey);
    if (!record || record.ownerId !== this.#id) {
      return false;
    }

    record.expiresAt = Date.now() + LOCK_TTL_MS;
    locks.set(this.#lockKey, record);

    return true;
  }
}

export const withLock = async <T>(key: string, fn: (signal: AbortSignal) => Promise<T>) => {
  const lock = new Lock(key);

  const acquired = await lock.acquire();
  if (!acquired) {
    throw new Error(`Failed to acquire lock for key: ${key}`);
  }

  try {
    return await fn(lock.signal);
  } finally {
    await lock.release();
  }
};
