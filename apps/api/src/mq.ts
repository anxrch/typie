export type EnqueueJobOptions = {
  delay?: number;
  priority?: number;
};

export const enqueueJob = async (name: string, data: unknown, options?: EnqueueJobOptions) => {
  void name;
  void data;
  void options;
};
