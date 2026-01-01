<script lang="ts">
  import { isiOS, isMacOS } from '@tiptap/core';
  import { css } from '@typie/styled-system/css';
  import { center } from '@typie/styled-system/patterns';
  import { tooltip } from '@typie/ui/actions';
  import { Canvas, CanvasEditor } from '@typie/ui/canvas';
  import { Helmet, Icon, Menu } from '@typie/ui/components';
  import { getAppContext, getThemeContext } from '@typie/ui/context';
  import dayjs from 'dayjs';
  import { nanoid } from 'nanoid';
  import { onMount, tick, untrack } from 'svelte';
  import { match } from 'ts-pattern';
  import { IndexeddbPersistence } from 'y-indexeddb';
  import * as Y from 'yjs';
  import { CanvasSyncType } from '@/enums';
  import ElipsisIcon from '~icons/lucide/ellipsis';
  import LineSquiggleIcon from '~icons/lucide/line-squiggle';
  import XIcon from '~icons/lucide/x';
  import { browser } from '$app/environment';
  import { fragment, graphql } from '$graphql';
  import CanvasMenu from '../../@context-menu/CanvasMenu.svelte';
  import CloseSplitView from '../@split-view/CloseSplitView.svelte';
  import { getViewContext } from '../@split-view/context.svelte';
  import { getDragDropContext } from '../@split-view/drag-context.svelte.ts';
  import { dragView } from '../@split-view/drag-view-action';
  import { YState } from '../state.svelte';
  import Panel from './Panel.svelte';
  import Toolbar from './Toolbar.svelte';
  import Zoom from './Zoom.svelte';
  import type { Canvas_query } from '$graphql';

  type Props = {
    $query: Canvas_query;
    focused: boolean;
    slug: string;
  };

  let { $query: _query, focused, slug }: Props = $props();

  const query = fragment(
    _query,
    graphql(`
      fragment Canvas_query on Query {
        me @required {
          id
          name
          role
        }

        entities(slugs: $slugs) {
          id
          slug
          url

          ancestors {
            id

            node {
              __typename

              ... on Folder {
                id
                name
              }
            }
          }

          node {
            __typename

            ... on Canvas {
              id
              title
              update
            }
          }
        }
      }
    `),
  );

  const syncCanvas = graphql(`
    mutation DashboardSlugPage_Canvas_SyncCanvas_Mutation($input: SyncCanvasInput!) {
      syncCanvas(input: $input)
    }
  `);

  const app = getAppContext();
  const theme = getThemeContext();
  const splitViewId = getViewContext().id;
  const dragDropContext = getDragDropContext();
  const dragViewProps = $derived({ dragDropContext, viewId: splitViewId });
  const clientId = nanoid();
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  let entity = $state<(typeof $query.entities)[number]>($query.entities.find((entity) => entity.slug === slug)!);

  $effect(() => {
    void slug;

    untrack(() => {
      const next = $query.entities.find((entity) => entity.slug === slug);
      if (next) {
        entity = next;
      }
    });
  });

  const canvasId = $derived(entity.node.__typename === 'Canvas' ? entity.node.id : null);

  let canvas = $state<Canvas>();

  const doc = new Y.Doc();

  const title = new YState<string>(doc, 'title', '');
  const effectiveTitle = $derived(title.current || '(제목 없음)');

  let titleInputEl = $state<HTMLInputElement>();
  let titleEditing = $state(false);
  let titleEditingText = $state('');

  const fullSync = async () => {
    if (!canvasId) return;

    const update = Y.encodeStateAsUpdateV2(doc);

    await syncCanvas({
      clientId,
      canvasId,
      type: CanvasSyncType.UPDATE,
      data: update.toBase64(),
    });
  };

  onMount(() => {
    if (!canvasId) return;

    const persistence = new IndexeddbPersistence(`typie:canvas:${canvasId}`, doc);

    if (entity.node.__typename === 'Canvas') {
      Y.applyUpdateV2(doc, Uint8Array.fromBase64(entity.node.update), 'remote');
    }

    const fullSyncInterval = setInterval(() => fullSync(), 60_000);

    if (canvas) {
      const { x, y, width, height } = canvas.scene.getLayer().getClientRect();
      const stageWidth = canvas.stage.width();
      const stageHeight = canvas.stage.height();

      canvas.moveTo(-(x + width / 2 - stageWidth / 2), -(y + height / 2 - stageHeight / 2));

      // 여유도 주고 node 없을 때 div0 되지 않게 100 더함
      canvas.scaleTo(Math.min(stageWidth / (width + 100), stageHeight / (height + 100), 1));
    }

    fullSync();

    return () => {
      clearInterval(fullSyncInterval);

      persistence.destroy();
      doc.destroy();
    };
  });

  $effect(() => {
    const currentTheme = theme.effective;

    if (canvas && currentTheme) {
      canvas.environment.update();
      canvas.stage.batchDraw();
    }
  });

  $effect(() => {
    if (focused) {
      app.state.ancestors = entity.ancestors.map((ancestor) => ancestor.id);
      app.state.current = entity.id;
    }
  });
</script>

<svelte:window
  onkeydown={(e) => {
    if (!focused) return;

    const modKey = isMacOS() || isiOS() ? e.metaKey : e.ctrlKey;

    if (modKey && e.key === 'z' && !e.shiftKey) {
      e.preventDefault();
      e.stopPropagation();
      canvas?.undo();
    } else if ((modKey && e.key === 'y') || (modKey && e.key === 'z' && e.shiftKey)) {
      e.preventDefault();
      e.stopPropagation();
      canvas?.redo();
    }
  }}
/>

{#if focused}
  <Helmet title={`${effectiveTitle} 그리는 중`} />
{/if}

<div class={css({ position: 'relative', flex: '1', overflowX: 'auto' })}>
  <CanvasEditor style={css.raw({ size: 'full' })} {doc} bind:canvas />

  <div
    class={center({
      position: 'absolute',
      top: '20px',
      left: '20px',
      gap: '12px',
      borderRadius: '12px',
      paddingX: '16px',
      paddingY: '12px',
      color: 'text.default',
      backgroundColor: 'surface.default',
      boxShadow: 'small',
      userSelect: 'none',
    })}
    role="region"
    use:dragView={dragViewProps}
  >
    <Icon style={css.raw({ color: 'text.faint' })} icon={LineSquiggleIcon} size={16} />

    {#if titleEditing}
      <input
        bind:this={titleInputEl}
        class={css({ fontSize: '14px', fontWeight: 'bold' })}
        onblur={() => {
          titleEditing = false;
          title.current = titleEditingText;
        }}
        onkeydown={(e) => {
          e.stopPropagation();

          if (e.key === 'Enter') {
            titleEditing = false;
            title.current = titleEditingText;
          } else if (e.key === 'Escape') {
            titleEditing = false;
            titleEditingText = title.current;
          }
        }}
        placeholder="(제목 없음)"
        type="text"
        bind:value={titleEditingText}
      />
    {:else}
      <button
        class={css({ fontSize: '14px', fontWeight: 'bold', cursor: 'text', whiteSpace: 'nowrap' })}
        ondblclick={async () => {
          titleEditingText = title.current;
          titleEditing = true;
          await tick();
          titleInputEl?.select();
        }}
        type="button"
      >
        {effectiveTitle}
      </button>
    {/if}

    <div class={center({ gap: '4px' })}>
      <Menu placement="bottom-start">
        {#snippet button({ open })}
          <button
            class={center({
              borderRadius: '4px',
              size: '24px',
              color: 'text.faint',
              transition: 'common',
              _hover: {
                color: 'text.subtle',
                backgroundColor: 'surface.muted',
              },
              _pressed: {
                color: 'text.subtle',
                backgroundColor: 'surface.muted',
              },
            })}
            aria-pressed={open}
            type="button"
          >
            <Icon icon={ElipsisIcon} size={16} />
          </button>
        {/snippet}

        {#if entity.node.__typename === 'Canvas'}
          <CanvasMenu canvas={entity.node} {entity} via="editor" />
        {/if}
      </Menu>
      <CloseSplitView>
        <Icon icon={XIcon} size={16} />
      </CloseSplitView>
    </div>
  </div>

  {#if canvas}
    <Toolbar {canvas} />
    <Zoom {canvas} />
    <Panel {canvas} />
  {/if}
</div>
