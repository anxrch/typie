import dayjs from 'dayjs';
import { and, asc, eq, inArray } from 'drizzle-orm';
import {
  CanvasContents,
  Canvases,
  CanvasSnapshots,
  db,
  Entities,
  firstOrThrow,
  firstOrThrowWith,
  Notes,
  TableCode,
  validateDbId,
} from '@/db';
import { EntityAvailability, EntityState, NoteState } from '@/enums';
import { NotFoundError } from '@/errors';
import { assertSitePermission } from '@/utils/permission';
import { builder } from '../builder';
import { Canvas, CanvasSnapshot, CanvasView, Entity, EntityView, ICanvas, isTypeOf } from '../objects';

/**
 * * Types
 */

ICanvas.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.string({ resolve: (self) => self.title || '(제목 없음)' }),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
    updatedAt: t.expose('updatedAt', { type: 'DateTime' }),
  }),
});

Canvas.implement({
  isTypeOf: isTypeOf(TableCode.CANVASES),
  interfaces: [ICanvas],
  fields: (t) => ({
    view: t.expose('id', { type: CanvasView }),

    update: t.field({
      type: 'Binary',
      resolve: async (self) => {
        const content = await db
          .select({ update: CanvasContents.update })
          .from(CanvasContents)
          .where(eq(CanvasContents.canvasId, self.id))
          .then(firstOrThrow);

        return content.update;
      },
    }),

    snapshots: t.field({
      type: [CanvasSnapshot],
      resolve: async (self) => {
        return await db.select().from(CanvasSnapshots).where(eq(CanvasSnapshots.canvasId, self.id)).orderBy(asc(CanvasSnapshots.createdAt));
      },
    }),

    entity: t.expose('entityId', { type: Entity }),
  }),
});

CanvasView.implement({
  isTypeOf: isTypeOf(TableCode.CANVASES),
  interfaces: [ICanvas],
  fields: (t) => ({
    shapes: t.field({
      type: 'JSON',
      resolve: async (self, _, ctx) => {
        const loader = ctx.loader({
          name: 'CanvasView.shapes',
          load: async (ids) => {
            return await db
              .select({ canvasId: CanvasContents.canvasId, shapes: CanvasContents.shapes })
              .from(CanvasContents)
              .where(inArray(CanvasContents.canvasId, ids));
          },
          key: ({ canvasId }) => canvasId,
        });

        const content = await loader.load(self.id);
        return content.shapes;
      },
    }),

    entity: t.expose('entityId', { type: EntityView }),
  }),
});

CanvasSnapshot.implement({
  isTypeOf: isTypeOf(TableCode.CANVAS_SNAPSHOTS),
  fields: (t) => ({
    id: t.exposeID('id'),
    snapshot: t.expose('snapshot', { type: 'Binary' }),
    createdAt: t.expose('createdAt', { type: 'DateTime' }),
  }),
});

/**
 * * Queries
 */

builder.queryFields((t) => ({
  canvas: t.withAuth({ session: true }).field({
    type: Canvas,
    args: { slug: t.arg.string() },
    resolve: async (_, args, ctx) => {
      const { canvas, entity } = await db
        .select({ canvas: Canvases, entity: { siteId: Entities.siteId, availability: Entities.availability } })
        .from(Canvases)
        .innerJoin(Entities, eq(Canvases.entityId, Entities.id))
        .where(eq(Entities.slug, args.slug))
        .then(firstOrThrowWith(new NotFoundError()));

      if (entity.availability === EntityAvailability.PRIVATE) {
        await assertSitePermission({
          userId: ctx.session.userId,
          siteId: entity.siteId,
        }).catch(() => {
          throw new NotFoundError();
        });
      }

      return canvas;
    },
  }),
}));

/**
 * * Mutations
 */

builder.mutationFields((t) => ({
  deleteCanvas: t.withAuth({ session: true }).fieldWithInput({
    type: Canvas,
    input: { canvasId: t.input.id({ validate: validateDbId(TableCode.CANVASES) }) },
    resolve: async (_, { input }, ctx) => {
      const entity = await db
        .select({ id: Entities.id, siteId: Entities.siteId })
        .from(Entities)
        .innerJoin(Canvases, eq(Entities.id, Canvases.entityId))
        .where(eq(Canvases.id, input.canvasId))
        .then(firstOrThrow);

      await assertSitePermission({
        userId: ctx.session.userId,
        siteId: entity.siteId,
      });

      await db.transaction(async (tx) => {
        await tx
          .update(Entities)
          .set({
            state: EntityState.DELETED,
            deletedAt: dayjs(),
          })
          .where(eq(Entities.id, entity.id));

        await tx
          .update(Notes)
          .set({ state: NoteState.DELETED_CASCADED })
          .where(and(eq(Notes.entityId, entity.id), eq(Notes.state, NoteState.ACTIVE)));
      });

      return input.canvasId;
    },
  }),
}));
