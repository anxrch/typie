<script lang="ts">
  import '../app.css';
  import '../fonts.css';

  import { setupThemeContext } from '@typie/ui/context';
  import { onMount } from 'svelte';

  let { children } = $props();

  setupThemeContext();

  onMount(() => {
    const setupMenu = async () => {
      try {
        const appModule = await import('@tauri-apps/api/app');
        const getName = appModule?.getName;
        if (!getName) return;

        await getName();

        const menuModule = await import('@tauri-apps/api/menu');
        const { Menu, PredefinedMenuItem, Submenu } = menuModule;

        const appMenu = await Submenu.new({
          text: '타이피',
          items: [
            await PredefinedMenuItem.new({
              item: 'Quit',
              text: '타이피 종료',
            }),
          ],
        });

        const edit = await Submenu.new({
          text: '편집',
          items: [
            await PredefinedMenuItem.new({
              item: 'Undo',
              text: '되돌리기',
            }),
            await PredefinedMenuItem.new({
              item: 'Redo',
              text: '다시하기',
            }),
            await PredefinedMenuItem.new({
              item: 'Separator',
            }),
            await PredefinedMenuItem.new({
              item: 'Cut',
              text: '잘라내기',
            }),
            await PredefinedMenuItem.new({
              item: 'Copy',
              text: '복사',
            }),
            await PredefinedMenuItem.new({
              item: 'Paste',
              text: '붙여넣기',
            }),
            await PredefinedMenuItem.new({
              item: 'SelectAll',
              text: '전체선택',
            }),
          ],
        });

        const menu = await Menu.new({
          items: [appMenu, edit],
        });

        await menu.setAsAppMenu();
      } catch (error) {
        console.debug('Skipping menu initialization', error);
      }
    };

    void setupMenu();
  });
</script>

<div
  data-tauri-drag-region="false"
  style="-webkit-app-region: no-drag; font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Apple SD Gothic Neo', 'Noto Sans KR', 'Malgun Gothic', sans-serif;"
>
  {@render children()}
</div>
