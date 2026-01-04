import '$lib/polyfills';
import '@typie/lib/dayjs';

import * as Sentry from '@sentry/sveltekit';
import { sequence } from '@sveltejs/kit/hooks';
import { logger } from '@typie/lib/svelte';
import { GlobalWindow } from 'happy-dom';
import { env } from '$env/dynamic/public';
import type { Handle, HandleServerError } from '@sveltejs/kit';

globalThis.__happydom__ = { window: new GlobalWindow() };

// 오프라인 모드에서는 Sentry 비활성화
if (env.PUBLIC_SENTRY_DSN) {
  Sentry.init({
    dsn: env.PUBLIC_SENTRY_DSN,
    sendDefaultPii: true,
  });
}

const log = logger.getChild('http');

const theme: Handle = async ({ event, resolve }) => {
  const theme = event.cookies.get('typie-th');

  return resolve(event, {
    transformPageChunk: ({ html }) => {
      if (event.url.pathname.includes('landing')) {
        return html.replace('%app.theme%', 'light');
      }

      const defaultTheme = event.url.pathname.includes('_webview') ? 'light' : 'auto';
      const themeValue = theme && ['auto', 'light', 'dark'].includes(theme) ? theme : defaultTheme;
      return html.replace('%app.theme%', themeValue);
    },
  });
};

const header: Handle = async ({ event, resolve }) => {
  return resolve(event, {
    filterSerializedResponseHeaders: (name) => {
      const n = name.toLowerCase();

      if (n === 'content-type') {
        return true;
      }

      return false;
    },
  });
};

const errorHandler: HandleServerError = ({ error, status, message }) => {
  log.error('Server error {*}', { status, message, error });
};

// 오프라인 모드에서는 Sentry 및 logging 미들웨어 비활성화
export const handle = sequence(theme, header);
export const handleError = errorHandler;
