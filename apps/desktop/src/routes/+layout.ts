import { Menu, PredefinedMenuItem, Submenu } from '@tauri-apps/api/menu';

export const ssr = false;

export const load = async () => {
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
};
