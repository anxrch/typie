import { redirect } from '@sveltejs/kit';
import { browser } from '$app/environment';

export const load = () => {
  // 오프라인 모드에서는 대시보드 대신 오프라인 에디터로 리다이렉트
  if (browser) {
    redirect(302, '/offline-editor');
  }
};

export const ssr = false;
