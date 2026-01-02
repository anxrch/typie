import { firstOrThrow, Sites } from '@/db';
import type { Transaction } from '@/db';

type CreateSiteParams = {
  userId: string;
  name: string;
  slug: string;
  tx: Transaction;
};

export const createSite = async ({ userId, name, slug, tx }: CreateSiteParams) => {
  const site = await tx
    .insert(Sites)
    .values({
      userId,
      slug,
      name,
    })
    .returning({
      id: Sites.id,
    })
    .then(firstOrThrow);

  return site;
};
