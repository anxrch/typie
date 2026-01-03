// cspell:disable
import { describe, expect, it, mock } from 'bun:test';
import { check } from './spellcheck';

const createCache = () => {
  const store = new Map<string, string>();
  return {
    store,
    get: async (key: string) => store.get(key) ?? null,
    setex: async (key: string, _ttl: number, value: string) => {
      store.set(key, value);
    },
  };
};

describe('spellcheck', () => {
  it('uses the remote spellcheck service when available and caches the response', async () => {
    const xml = `<PnuNlpSpeller><PnuErrorWordList><PnuErrorWord><nErrorIdx>0</nErrorIdx><m_nStart>0</m_nStart><m_nEnd>4</m_nEnd><CandWordList><m_nCount>1</m_nCount><CandWord>text</CandWord></CandWordList><Help nCorrectMethod="2">Use "text"</Help></PnuErrorWord></PnuErrorWordList></PnuNlpSpeller>`;
    const fetcher = mock(async () => xml);
    const cache = createCache();

    const first = await check('tezt', {
      offline: false,
      fetcher,
      cache,
      url: 'https://example.com/spellcheck',
      apiKey: 'key',
    });

    expect(fetcher.mock.calls.length).toBe(1);
    expect(first).toHaveLength(1);
    expect(first[0].corrections).toContain('text');

    const second = await check('tezt', {
      offline: false,
      fetcher,
      cache,
      url: 'https://example.com/spellcheck',
      apiKey: 'key',
    });

    expect(fetcher.mock.calls.length).toBe(1);
    expect(second).toHaveLength(1);
  });

  it('falls back to the offline checker and records cache entries', async () => {
    const cache = createCache();
    const text = 'Please recieve  this update.';

    const errors = await check(text, { offline: true, cache });

    const misspelling = errors.find((error) => error.corrections.includes('receive'));
    const spacing = errors.find((error) => error.type === 'statistical-spacing');

    expect(misspelling?.type).toBe('misused-word');
    expect(spacing).toBeDefined();
    expect([...cache.store.keys()].some((key) => key.startsWith('spellcheck:offline:'))).toBe(true);
  });
});
