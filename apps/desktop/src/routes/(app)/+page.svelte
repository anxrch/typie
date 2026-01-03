<script lang="ts">
  import { css } from '@typie/styled-system/css';
  import { center, flex } from '@typie/styled-system/patterns';
  import { nanoid } from 'nanoid';
  import { onMount } from 'svelte';
  import { store } from '$lib/store';

  type Note = {
    id: string;
    title: string;
    content: string;
    updatedAt: string;
  };

  let notes = $state<Note[]>([]);
  let selectedId: string | null = null;
  let editorTitle = '';
  let editorContent = '';
  let isLoading = true;

  const persistNotes = async () => {
    await store.set('offline_notes', notes);
  };

  const selectNote = (id: string | null) => {
    selectedId = id;
    const current = notes.find((note) => note.id === id);
    editorTitle = current?.title ?? '';
    editorContent = current?.content ?? '';
  };

  const saveCurrent = async () => {
    if (!selectedId) return;

    let updatedAt = new Date().toISOString();
    notes = notes.map((note) =>
      note.id === selectedId
        ? {
            ...note,
            title: editorTitle.trim() === '' ? '제목 없는 문서' : editorTitle,
            content: editorContent,
            updatedAt,
          }
        : note,
    );

    await persistNotes();
  };

  const createNote = async () => {
    await saveCurrent();

    const now = new Date().toISOString();
    const note: Note = {
      id: nanoid(),
      title: '새 문서',
      content: '',
      updatedAt: now,
    };

    notes = [note, ...notes];
    selectNote(note.id);
    await persistNotes();
  };

  const deleteNote = async (id: string) => {
    notes = notes.filter((note) => note.id !== id);
    if (selectedId === id) {
      const fallback = notes.at(0)?.id ?? null;
      selectNote(fallback);
    }

    await persistNotes();
  };

  const switchNote = async (id: string) => {
    if (selectedId === id) return;

    await saveCurrent();
    selectNote(id);
  };

  const loadNotes = async () => {
    const saved = await store.get<Note[]>('offline_notes');
    notes = saved ?? [];

    if (notes.length === 0) {
      await createNote();
    } else {
      selectNote(notes[0].id);
    }

    isLoading = false;
  };

  const formatUpdatedAt = (value: string) =>
    new Intl.DateTimeFormat('ko-KR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));

  onMount(() => {
    loadNotes();
  });
</script>

<div class={flex({ width: '[100vw]', height: '[100vh]', backgroundColor: 'surface.subtle' })}>
  <aside
    class={flex({
      width: '280px',
      height: 'full',
      padding: '16px',
      borderRightWidth: '[0.5px]',
      borderColor: 'gray.200',
      flexDirection: 'column',
      gap: '12px',
      backgroundColor: 'surface.default',
    })}
  >
    <div>
      <h1 class={css({ fontSize: '18px', fontWeight: 'bold', marginBottom: '4px' })}>오프라인 노트</h1>
      <p class={css({ color: 'gray.600', fontSize: '13px', lineHeight: '[1.5]' })}>
        인터넷 연결 없이도 바로 기록할 수 있어요. 모든 내용은 기기 안에만 저장됩니다.
      </p>
    </div>

    <button
      class={css({
        padding: '10px 12px',
        borderRadius: '8px',
        backgroundColor: 'accent.brand.default',
        color: 'white',
        fontWeight: 'semibold',
        transition: 'all 0.15s ease',
        _hover: { backgroundColor: 'accent.brand.strong' },
        _active: { translate: '0 1px' },
      })}
      disabled={isLoading}
      onclick={createNote}
      type="button"
    >
      새 노트 만들기
    </button>

    <div class={flex({ flexDirection: 'column', gap: '8px', overflowY: 'auto', flexGrow: '1' })}>
      {#if notes.length === 0 && !isLoading}
        <div class={css({ color: 'gray.600', fontSize: '13px' })}>아직 노트가 없어요.</div>
      {:else}
        {#each notes as note (note.id)}
          <button
            class={css({
              padding: '10px 12px',
              borderRadius: '8px',
              textAlign: 'left',
              borderWidth: selectedId === note.id ? '1px' : '[0.5px]',
              borderColor: selectedId === note.id ? 'accent.brand.default' : 'gray.200',
              backgroundColor: selectedId === note.id ? 'accent.brand.muted' : 'white',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              _hover: { backgroundColor: 'gray.50' },
            })}
            onclick={() => switchNote(note.id)}
            type="button"
          >
            <div class={css({ fontWeight: 'semibold', color: 'text.default' })}>{note.title}</div>
            <div class={css({ fontSize: '12px', color: 'gray.600', marginTop: '4px' })}>
              마지막 수정: {formatUpdatedAt(note.updatedAt)}
            </div>
          </button>
        {/each}
      {/if}
    </div>
  </aside>

  <section class={flex({ flexDirection: 'column', flexGrow: '1', height: 'full', padding: '16px', gap: '12px' })}>
    {#if selectedId}
      <div class={flex({ justifyContent: 'space-between', alignItems: 'center', gap: '8px' })}>
        <input
          class={css({
            width: 'full',
            padding: '12px',
            borderRadius: '8px',
            borderWidth: '1px',
            borderColor: 'gray.300',
            fontSize: '16px',
            fontWeight: 'semibold',
            outline: 'none',
            backgroundColor: 'white',
            _focusWithin: { borderColor: 'accent.brand.default', boxShadow: '[0 0 0 2px {colors.accent.brand.muted}]' },
          })}
          disabled={isLoading}
          onblur={saveCurrent}
          oninput={(event) => (editorTitle = (event.target as HTMLInputElement).value)}
          placeholder="제목을 입력하세요"
          value={editorTitle}
        />

        <button
          class={css({
            padding: '10px 12px',
            borderRadius: '8px',
            borderWidth: '1px',
            borderColor: 'gray.300',
            backgroundColor: 'white',
            color: 'gray.700',
            _hover: { backgroundColor: 'gray.50' },
          })}
          disabled={isLoading}
          onclick={async () => {
            if (selectedId) {
              await deleteNote(selectedId);
            }
          }}
          type="button"
        >
          노트 삭제
        </button>
      </div>

      <textarea
        class={css({
          flexGrow: '1',
          width: 'full',
          minHeight: '400px',
          padding: '16px',
          borderRadius: '12px',
          borderWidth: '1px',
          borderColor: 'gray.300',
          backgroundColor: 'white',
          fontSize: '15px',
          lineHeight: '[1.6]',
          outline: 'none',
          resize: 'vertical',
          _focusWithin: { borderColor: 'accent.brand.default', boxShadow: '[0 0 0 2px {colors.accent.brand.muted}]' },
        })}
        disabled={isLoading}
        onblur={saveCurrent}
        oninput={(event) => (editorContent = (event.target as HTMLTextAreaElement).value)}
        placeholder="아이디어, 메모, 글감을 자유롭게 적어보세요. 내용은 모두 로컬에만 저장돼요."
        value={editorContent}
      ></textarea>

      <div class={flex({ justifyContent: 'space-between', alignItems: 'center' })}>
        <div class={css({ color: 'gray.600', fontSize: '13px' })}>
          변경 사항은 기기 안에 저장되며, 인터넷 없이도 계속 편집할 수 있어요.
        </div>

        <div class={flex({ gap: '8px' })}>
          <button
            class={css({
              padding: '10px 12px',
              borderRadius: '8px',
              borderWidth: '1px',
              borderColor: 'gray.300',
              backgroundColor: 'white',
              color: 'gray.700',
              _hover: { backgroundColor: 'gray.50' },
            })}
            disabled={isLoading}
            onclick={createNote}
            type="button"
          >
            새 노트
          </button>

          <button
            class={css({
              padding: '10px 16px',
              borderRadius: '8px',
              backgroundColor: 'accent.brand.default',
              color: 'white',
              fontWeight: 'semibold',
              _hover: { backgroundColor: 'accent.brand.strong' },
              _active: { translate: '0 1px' },
            })}
            disabled={isLoading}
            onclick={saveCurrent}
            type="button"
          >
            변경 내용 저장
          </button>
        </div>
      </div>
    {:else}
      <div class={center({ flexDirection: 'column', gap: '12px', height: 'full' })}>
        <h2 class={css({ fontSize: '20px', fontWeight: 'bold' })}>불러올 노트가 없어요</h2>
        <p class={css({ color: 'gray.600', fontSize: '14px', textAlign: 'center' })}>
          새 노트를 만들어 오프라인으로 바로 작성해보세요.
        </p>
        <button
          class={css({
            padding: '10px 16px',
            borderRadius: '8px',
            backgroundColor: 'accent.brand.default',
            color: 'white',
            fontWeight: 'semibold',
            _hover: { backgroundColor: 'accent.brand.strong' },
            _active: { translate: '0 1px' },
          })}
          disabled={isLoading}
          onclick={createNote}
          type="button"
        >
          첫 노트 만들기
        </button>
      </div>
    {/if}
  </section>
</div>
