<script lang="ts">
  import { css } from '@typie/styled-system/css';
  import { flex } from '@typie/styled-system/patterns';
  import { createFloatingActions, portal } from '@typie/ui/actions';
  import { Icon, RingSpinner } from '@typie/ui/components';
  import { clamp } from '@typie/ui/utils';
  import dayjs from 'dayjs';
  import { untrack } from 'svelte';
  import { fly } from 'svelte/transition';
  import IconClockFading from '~icons/lucide/clock-fading';
  import { fragment, graphql } from '$graphql';
  import type { PointerEventHandler } from 'svelte/elements';
  import type { Editor_Timeline_post } from '$graphql';

  type Props = {
    $post: Editor_Timeline_post;
  };

  let { $post: _post }: Props = $props();

  const post = fragment(
    _post,
    graphql(`
      fragment Editor_Timeline_post on Post {
        id

        entity {
          id
          slug
        }
      }
    `),
  );

  const query = graphql(`
    query Editor_Timeline_Query($slug: String!) @client {
      post(slug: $slug) {
        id
        update

        snapshots {
          id
          snapshot
          createdAt
        }
      }
    }
  `);

  const { anchor, floating, arrow } = createFloatingActions({
    placement: 'top',
    offset: 8,
    arrow: true,
  });

  let value = $state(0);
  let showTooltip = $state(false);

  const title = $state('');
  const subtitle = $state('');
  const maxWidth = $state(800);

  const max = $derived($query ? $query.post.snapshots.length - 1 : 0);
  const p = $derived(max > 0 ? `${(value / max) * 100}%` : '0%');

  let initialized = $state(false);

  const initialize = async () => {
    const resp = await query.load({ slug: $post.entity.slug });
    value = resp.post.snapshots.length - 1;
    initialized = true;
  };

  $effect(() => {
    untrack(() => initialize());
  });

  const handler: PointerEventHandler<HTMLElement> = (e) => {
    if (!e.currentTarget.parentElement || !$query) {
      return;
    }

    const { left: parentLeft, width: parentWidth } = e.currentTarget.parentElement.getBoundingClientRect();
    const { clientX: pointerLeft } = e;
    const ratio = clamp((pointerLeft - parentLeft) / parentWidth, 0, 1);
    value = Math.round(ratio * max);
  };
</script>

<div class={flex({ flexGrow: '1', overflowY: 'hidden' })}>
  <div class={css({ position: 'relative', flexGrow: '1', height: 'full', overflowY: 'auto', scrollbarGutter: 'stable' })}>
    <div
      style:--prosemirror-max-width={`${maxWidth}px`}
      class={flex({
        flexDirection: 'column',
        alignItems: 'center',
        paddingTop: '60px',
        paddingX: '80px',
        size: 'full',
      })}
    >
      <div class={flex({ flexDirection: 'column', width: 'full', maxWidth: 'var(--prosemirror-max-width)' })}>
        <textarea
          class={css({ width: 'full', fontSize: '28px', fontWeight: 'bold', resize: 'none' })}
          maxlength="100"
          placeholder="제목을 입력하세요"
          readonly
          rows={1}
          spellcheck="false"
          value={title}
        ></textarea>

        <textarea
          class={css({ marginTop: '4px', width: 'full', fontSize: '16px', fontWeight: 'medium', overflow: 'hidden', resize: 'none' })}
          maxlength="100"
          placeholder="부제목을 입력하세요"
          readonly
          rows={1}
          spellcheck="false"
          value={subtitle}
        ></textarea>

        <div class={css({ marginTop: '10px', marginBottom: '20px', borderBottomWidth: '1px', borderColor: 'gray.200' })}></div>
      </div>

      <div class={css({ position: 'relative', flexGrow: '1', width: 'full' })}>
        <div class={css({ padding: '20px', color: 'gray.500', textAlign: 'center' })}>
          {#if initialized && $query}
            스냅샷 내용 표시
          {:else}
            로딩 중...
          {/if}
        </div>
      </div>
    </div>
  </div>
</div>

<div
  class={flex({
    position: 'fixed',
    left: '1/2',
    bottom: '32px',
    align: 'center',
    gap: '16px',
    borderRadius: '12px',
    padding: '12px',
    paddingRight: '16px',
    backgroundColor: 'white',
    border: '1px solid',
    borderColor: 'gray.200',
    zIndex: '30',
    translate: 'auto',
    translateX: '-1/2',
    boxShadow: '[0_8px_32px_rgba(0,0,0,0.08)]',
  })}
  use:portal
  in:fly={{ y: 40, duration: 250 }}
>
  <Icon style={css.raw({ color: 'gray.500' })} icon={IconClockFading} size={18} />

  {#if $query}
    <div class={flex({ position: 'relative', align: 'center', width: '420px', height: '36px', paddingX: '4px' })}>
      <div
        class={css({
          position: 'relative',
          borderRadius: 'full',
          width: 'full',
          height: '4px',
          backgroundColor: 'gray.200',
          overflow: 'hidden',
          cursor: 'pointer',
          transition: 'all',
          transitionDuration: '150ms',
          _hover: {
            backgroundColor: 'gray.300',
          },
        })}
        onpointerdown={handler}
      >
        <div
          style:width={p}
          class={css({
            height: 'full',
            backgroundColor: 'gray.900',
            transition: 'all',
            transitionDuration: '150ms',
            transitionTimingFunction: 'cubic-bezier(0.4, 0, 0.2, 1)',
          })}
        ></div>
      </div>
      <div class={css({ position: 'absolute', width: 'full', height: '36px', pointerEvents: 'none' })}>
        <button
          style:left={p}
          class={css({
            position: 'absolute',
            top: '1/2',
            borderRadius: 'full',
            size: '16px',
            backgroundColor: 'white',
            border: '2px solid',
            borderColor: 'gray.300',
            translate: 'auto',
            translateX: '-1/2',
            translateY: '-1/2',
            pointerEvents: 'auto',
            touchAction: 'none',
            cursor: 'ew-resize',
            transition: 'all',
            transitionDuration: '150ms',
            boxShadow: '[0_2px_8px_rgba(0,0,0,0.1)]',
            _hover: {
              scale: '[1.2]',
              boxShadow: '[0_4px_12px_rgba(0,0,0,0.15)]',
            },
            _active: {
              scale: '[1.1]',
            },
          })}
          aria-label="Timeline slider"
          ondragstart={(e: DragEvent) => e.preventDefault()}
          onpointerdown={(e: PointerEvent) => {
            showTooltip = true;
            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
          }}
          onpointermove={(e: PointerEvent) => {
            e.preventDefault();
            if ((e.currentTarget as HTMLElement).hasPointerCapture(e.pointerId)) {
              handler(e as PointerEvent & { currentTarget: HTMLElement });
            }
          }}
          onpointerup={() => {
            showTooltip = false;
          }}
          type="button"
          use:anchor
        ></button>
      </div>
    </div>

    <div
      class={css({
        fontSize: '13px',
        fontFeatureSettings: '"tnum" 1',
        color: 'gray.700',
        whiteSpace: 'nowrap',
        minWidth: '150px',
        textAlign: 'center',
      })}
    >
      {dayjs($query.post.snapshots[value].createdAt).format('YYYY. MM. DD HH:mm')}
    </div>

    <div
      class={css({
        paddingX: '12px',
        paddingY: '8px',
        backgroundColor: 'gray.900',
        borderRadius: '8px',
        zIndex: '40',
        fontSize: '12px',
        color: 'white',
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        opacity: showTooltip ? '1' : '0',
        transition: 'opacity',
        transitionDuration: '150ms',
        boxShadow: '[0_4px_12px_rgba(0,0,0,0.15)]',
      })}
      role="tooltip"
      use:floating
    >
      {dayjs($query.post.snapshots[value].createdAt).format('YYYY. MM. DD HH:mm:ss')}
      <div
        class={css({
          size: '6px',
          backgroundColor: 'gray.900',
          zIndex: '1',
        })}
        use:arrow
      ></div>
    </div>
  {:else}
    <div class={flex({ justify: 'center', align: 'center', width: '420px', height: '36px' })}>
      <RingSpinner style={css.raw({ size: '18px', color: 'gray.500' })} />
    </div>
  {/if}
</div>
