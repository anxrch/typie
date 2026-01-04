<script lang="ts">
  import { css } from '@typie/styled-system/css';
  import { center, flex } from '@typie/styled-system/patterns';
  import { Helmet } from '@typie/ui/components';
  import { onMount } from 'svelte';

  // 간단한 오프라인 에디터 상태
  let content = $state('');
  let title = $state('제목 없음');
  let lastSaved = $state<Date | null>(null);

  // 로컬 스토리지에서 저장된 내용 불러오기
  onMount(() => {
    const savedContent = localStorage.getItem('offline-editor-content');
    const savedTitle = localStorage.getItem('offline-editor-title');

    if (savedContent) content = savedContent;
    if (savedTitle) title = savedTitle;
  });

  // 자동 저장 기능
  const saveContent = () => {
    localStorage.setItem('offline-editor-content', content);
    localStorage.setItem('offline-editor-title', title);
    lastSaved = new Date();
  };

  // 내용이 변경될 때마다 저장
  $effect(() => {
    const timer = setTimeout(() => {
      saveContent();
    }, 1000);

    return () => clearTimeout(timer);
  });
</script>

<Helmet description="오프라인 글쓰기 도구" title="타이피 오프라인 에디터" trailing={null} />

<div
  class={flex({
    flexDirection: 'column',
    height: '[100dvh]',
    backgroundColor: 'surface.default',
  })}
>
  <!-- 헤더 -->
  <header
    class={flex({
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingX: '24px',
      paddingY: '16px',
      borderBottom: '1px solid {colors.border.subtle}',
      backgroundColor: 'surface.default',
    })}
  >
    <h1
      class={css({
        fontSize: '18px',
        fontWeight: 'bold',
        color: 'text.default',
      })}
    >
      타이피 오프라인 에디터
    </h1>
    {#if lastSaved}
      <span
        class={css({
          fontSize: '12px',
          color: 'text.faint',
        })}
      >
        마지막 저장: {lastSaved.toLocaleTimeString('ko-KR')}
      </span>
    {/if}
  </header>

  <!-- 에디터 영역 -->
  <div
    class={flex({
      flexDirection: 'column',
      flexGrow: '1',
      overflow: 'auto',
      padding: '24px',
    })}
  >
    <div
      class={flex({
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '800px',
        width: 'full',
        marginX: 'auto',
      })}
    >
      <!-- 제목 입력 -->
      <input
        class={css({
          fontSize: '32px',
          fontWeight: 'bold',
          color: 'text.default',
          backgroundColor: 'transparent',
          border: 'none',
          outline: 'none',
          padding: '8px',
          width: 'full',
          _placeholder: {
            color: 'text.faint',
          },
        })}
        placeholder="제목을 입력하세요"
        type="text"
        bind:value={title}
      />

      <!-- 본문 입력 -->
      <textarea
        class={css({
          fontSize: '16px',
          lineHeight: '[1.6]',
          color: 'text.default',
          backgroundColor: 'transparent',
          border: 'none',
          outline: 'none',
          padding: '8px',
          width: 'full',
          minHeight: '400px',
          resize: 'vertical',
          _placeholder: {
            color: 'text.faint',
          },
        })}
        placeholder="내용을 입력하세요..."
        bind:value={content}
      ></textarea>
    </div>
  </div>

  <!-- 푸터 -->
  <footer
    class={center({
      padding: '16px',
      borderTop: '1px solid {colors.border.subtle}',
      backgroundColor: 'surface.default',
    })}
  >
    <p
      class={css({
        fontSize: '12px',
        color: 'text.faint',
      })}
    >
      모든 내용은 브라우저의 로컬 스토리지에 자동으로 저장됩니다.
    </p>
  </footer>
</div>
