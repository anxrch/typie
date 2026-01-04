import { redirect } from '@sveltejs/kit';

export const load = () => {
  // 오프라인 모드에서는 대시보드 대신 오프라인 에디터로 리다이렉트
  redirect(302, '/offline-editor');
};

export const ssr = false;
