// spell-checker:words cand

import * as Sentry from '@sentry/bun';
import { XMLParser } from 'fast-xml-parser';
import DOMPurify from 'isomorphic-dompurify';
import ky from 'ky';
import pMap from 'p-map';
import { rapidhash } from 'rapidhash-js';
import { redis } from '@/cache';
import { env } from '@/env';

const errorTypes = [
  'no-error',
  'morpheme-analysis',
  'misused-word',
  'multi-word',
  'semantic-style',
  'punctuation',
  'statistical-spacing',
  'english-misuse',
  'tagging',
  'compound-noun',
  'context-spacing',
] as const;

export type SpellingError = {
  index: number;
  start: number;
  end: number;
  context: string;
  corrections: string[];
  explanation: string;
  type: (typeof errorTypes)[number];
};

type CheckSpellResponse = {
  PnuNlpSpeller?: {
    PnuErrorWordList?: {
      Error?: string | { msg?: string };
      PnuErrorWord?: PnuErrorWord | PnuErrorWord[];
    };
  };
};

type PnuErrorWord = {
  nErrorIdx: string;
  m_nStart: string;
  m_nEnd: string;
  CandWordList?: {
    m_nCount: string;
    CandWord?: string | string[];
  };
  Help?: {
    '#text': string;
    nCorrectMethod?: string;
  };
};

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });

const MAX_CHUNK_SIZE = 500;
const MAX_CONCURRENCY = 100;
const CACHE_TTL_SECONDS = 60 * 60 * 24;

type CacheClient = {
  get: (key: string) => Promise<string | null>;
  setex: (key: string, ttl: number, value: string) => Promise<unknown>;
};

export type SpellcheckOptions = {
  offline?: boolean;
  cache?: CacheClient;
  fetcher?: (sentence: string) => Promise<string>;
  url?: string;
  apiKey?: string;
};

type NormalizedError = {
  index: number;
  start: number;
  end: number;
  corrections: string[];
  explanation: string;
  type: (typeof errorTypes)[number];
};

// cspell:disable
const offlineCorrections: Record<string, string[]> = {
  accomodate: ['accommodate'],
  adress: ['address'],
  adressing: ['addressing'],
  agressive: ['aggressive'],
  apparant: ['apparent'],
  arguement: ['argument'],
  beleive: ['believe'],
  calender: ['calendar'],
  definately: ['definitely'],
  enviroment: ['environment'],
  finaly: ['finally'],
  goverment: ['government'],
  greatful: ['grateful'],
  happend: ['happened'],
  harrasment: ['harassment'],
  occurence: ['occurrence'],
  ocurred: ['occurred'],
  recieve: ['receive'],
  recieving: ['receiving'],
  recomend: ['recommend'],
  responsability: ['responsibility'],
  seperate: ['separate'],
  sucessful: ['successful'],
  tommorow: ['tomorrow'],
  untill: ['until'],
  wierd: ['weird'],
  writting: ['writing'],
};
// cspell:enable

const spacingPattern = /\s{2,}/g;
const wordPattern = /\b([A-Za-z][A-Za-z']+)\b/g;

const memoryCache = new Map<string, string>();
const memoryOnlyCache: CacheClient = {
  get: async (key) => memoryCache.get(key) ?? null,
  setex: async (key, _ttl, value) => {
    memoryCache.set(key, value);
  },
};

const buildOfflineErrors = (normalizedText: string): NormalizedError[] => {
  const errors: NormalizedError[] = [];

  const wordMatcher = new RegExp(wordPattern.source, wordPattern.flags);
  let match;
  while ((match = wordMatcher.exec(normalizedText))) {
    const word = match[1];
    const start = match.index ?? 0;
    const correction = offlineCorrections[word.toLowerCase()];
    if (!correction) continue;

    errors.push({
      index: errors.length,
      start,
      end: start + word.length,
      corrections: correction,
      explanation: 'Offline dictionary suggestion',
      type: 'misused-word',
    });
  }

  const spacingMatcher = new RegExp(spacingPattern.source, spacingPattern.flags);
  while ((match = spacingMatcher.exec(normalizedText))) {
    const start = match.index ?? 0;
    errors.push({
      index: errors.length,
      start,
      end: start + match[0].length,
      corrections: [' '],
      explanation: 'Offline checker found repeated spacing',
      type: 'statistical-spacing',
    });
  }

  return errors;
};

const inflateError = (
  error: NormalizedError,
  chunk: { text: string; start: number; end: number },
  normalized: ReturnType<typeof normalize>,
): SpellingError => {
  const start = normalized.map(error.start);
  const end = normalized.map(error.end, true);

  return {
    index: error.index,
    start: chunk.start + start,
    end: chunk.start + end,
    context: chunk.text.slice(start, end),
    corrections: error.corrections,
    explanation: error.explanation,
    type: error.type,
  };
};

const parseXmlErrors = (
  xml: string,
  chunk: { text: string; start: number; end: number },
  normalized: ReturnType<typeof normalize>,
): SpellingError[] => {
  try {
    const resp = parser.parse(xml) as CheckSpellResponse;
    const errorList = resp.PnuNlpSpeller?.PnuErrorWordList;

    if (errorList?.Error) {
      const msg = typeof errorList.Error === 'string' ? errorList.Error : errorList.Error.msg;
      if (msg !== '문법 및 철자 오류가 발견되지 않았습니다.') {
        Sentry.captureException(new Error(`Spellcheck API error: ${msg}`));
      }

      return [];
    }

    if (!errorList?.PnuErrorWord) return [];

    const errors = [errorList.PnuErrorWord].flat() as PnuErrorWord[];
    const chunkText = chunk.text;

    return errors.map((error) => {
      const start = normalized.map(Number(error.m_nStart));
      const end = normalized.map(Number(error.m_nEnd), true);
      const type = errorTypes[Number(error.Help?.nCorrectMethod)] ?? 'no-error';

      return {
        index: Number(error.nErrorIdx),
        start: chunk.start + start,
        end: chunk.start + end,
        context: chunkText.slice(start, end),
        corrections:
          error.CandWordList && Number(error.CandWordList.m_nCount) > 0
            ? [error.CandWordList.CandWord].flat().filter((x) => x !== undefined)
            : [],
        explanation: DOMPurify.sanitize(error.Help?.['#text'] ?? '', { ALLOWED_TAGS: ['br'] }),
        type,
      };
    });
  } catch (err) {
    Sentry.captureException(err);
    return [];
  }
};

const createRemoteFetcher =
  (url?: string, apiKey?: string) =>
  async (sentence: string): Promise<string> => {
    if (!url || !apiKey) {
      throw new Error('Spellcheck remote configuration is missing');
    }

    return ky
      .post(url, {
        headers: { 'x-api-key': apiKey },
        json: { sentence },
      })
      .text();
  };

const shouldUseOffline = (options: SpellcheckOptions, url?: string, apiKey?: string) => {
  if (options.offline !== undefined) {
    return options.offline || !url || !apiKey;
  }

  return env.SPELLCHECK_OFFLINE || !url || !apiKey;
};

const getCachedValue = async (key: string, cache: CacheClient) => {
  try {
    const cached = await cache.get(key);
    if (cached) return cached;
  } catch (err) {
    Sentry.captureException(err);
  }

  return memoryCache.get(key) ?? null;
};

const setCachedValue = async (key: string, value: string, cache: CacheClient) => {
  memoryCache.set(key, value);

  try {
    await cache.setex(key, CACHE_TTL_SECONDS, value);
  } catch (err) {
    Sentry.captureException(err);
  }
};

const getCachedErrors = async (key: string, cache: CacheClient) => {
  const cached = await getCachedValue(key, cache);
  if (!cached) return null;

  try {
    return JSON.parse(cached) as NormalizedError[];
  } catch (err) {
    Sentry.captureException(err);
    return null;
  }
};

const setCachedErrors = async (key: string, errors: NormalizedError[], cache: CacheClient) => {
  await setCachedValue(key, JSON.stringify(errors), cache);
};

const ALLOWED_CHARS = /^[\u{AC00}-\u{D7AF}\u{3131}-\u{318E}A-Za-z0-9\s.,!?:;()[\]"'/\\@#$%&*+=_~`{}<>|^。、「」『』“”‘’！？…·ㆍ-]$/u;
const SENTENCE_PATTERN = /([.!?。！？]+\s*)/g;

const normalize = (text: string) => {
  const removed: { pos: number; len: number }[] = [];
  let normalized = '';

  for (let i = 0; i < text.length; ) {
    const char = text[i];
    const code = text.codePointAt(i) || 0;

    if (i + 1 < text.length) {
      const nextCode = text.codePointAt(i + 1) || 0;
      const isSurrogatePair = code >= 0xd8_00 && code <= 0xdb_ff;
      const isVariationSelector = nextCode >= 0xfe_00 && nextCode <= 0xfe_0f;
      if (isSurrogatePair || isVariationSelector) {
        removed.push({ pos: i, len: 2 });
        i += 2;
        continue;
      }
    }

    if (ALLOWED_CHARS.test(char)) {
      normalized += char;
      i++;
    } else {
      removed.push({ pos: i, len: 1 });
      i++;
    }
  }

  const map = (offset: number, isLast = false) => {
    let originalPos = 0;
    let normalizedPos = 0;

    for (let i = 0; i < text.length; ) {
      const isRemoved = removed.find((r) => r.pos === i);

      if (isRemoved) {
        if (offset === normalizedPos && isLast) {
          return originalPos;
        }
        originalPos += isRemoved.len;
        i += isRemoved.len;
      } else {
        if (normalizedPos === offset) {
          return originalPos;
        }
        normalizedPos++;
        originalPos++;
        i++;
      }
    }

    return originalPos;
  };

  return { text: normalized, map };
};

export const check = async (text: string, options: SpellcheckOptions = {}) => {
  const normalized = normalize(text);

  if (!normalized.text.trim()) return [];

  const cache = options.cache ?? redis ?? memoryOnlyCache;
  const url = options.url ?? env.SPELLCHECK_URL;
  const apiKey = options.apiKey ?? env.SPELLCHECK_API_KEY;
  const offlineMode = shouldUseOffline(options, url, apiKey);
  const fetcher = options.fetcher ?? createRemoteFetcher(url, apiKey);

  const chunks: { text: string; start: number; end: number }[] = [];
  let chunk = '';
  let chunkStartOffset = 0;
  let offset = 0;

  const paragraphs: { text: string; start: number; end: number }[] = [];

  while (offset < text.length) {
    const nextNewline = text.indexOf('\n', offset);
    const paragraphEnd = nextNewline === -1 ? text.length : nextNewline;
    const paragraph = text.slice(offset, paragraphEnd);

    if (paragraph.trim().length > 0) {
      paragraphs.push({
        text: paragraph,
        start: offset,
        end: paragraphEnd,
      });
    }

    offset = paragraphEnd + 1;
  }

  let chunkEndOffset = 0;

  for (const paragraph of paragraphs) {
    if (chunk.length + (chunk ? 1 : 0) + paragraph.text.length <= MAX_CHUNK_SIZE) {
      if (chunk) {
        chunk += '\n' + paragraph.text;
        chunkEndOffset = paragraph.end;
      } else {
        chunk = paragraph.text;
        chunkStartOffset = paragraph.start;
        chunkEndOffset = paragraph.end;
      }
    } else {
      if (chunk && chunkEndOffset > 0) {
        chunks.push({
          text: text.slice(chunkStartOffset, chunkEndOffset),
          start: chunkStartOffset,
          end: chunkEndOffset,
        });
      }

      if (paragraph.text.length > MAX_CHUNK_SIZE) {
        let sentenceChunk = '';
        let sentenceStartOffset = paragraph.start;
        let sentenceEndOffset = paragraph.start;
        let endOffset = 0;

        const pattern = new RegExp(SENTENCE_PATTERN.source, SENTENCE_PATTERN.flags);
        let match;

        while ((match = pattern.exec(paragraph.text))) {
          const matchEndOffset = match.index + match[0].length;
          const sentence = paragraph.text.slice(endOffset, matchEndOffset);

          if (sentenceChunk.length + sentence.length <= MAX_CHUNK_SIZE) {
            sentenceChunk += sentence;
            sentenceEndOffset = paragraph.start + matchEndOffset;
          } else {
            if (sentenceChunk) {
              chunks.push({
                text: text.slice(sentenceStartOffset, sentenceEndOffset),
                start: sentenceStartOffset,
                end: sentenceEndOffset,
              });
            }
            sentenceChunk = sentence;
            sentenceStartOffset = paragraph.start + endOffset;
            sentenceEndOffset = paragraph.start + matchEndOffset;
          }
          endOffset = matchEndOffset;
        }

        const remaining = paragraph.text.slice(endOffset);
        if (remaining) {
          if (sentenceChunk.length + remaining.length <= MAX_CHUNK_SIZE) {
            sentenceChunk += remaining;
            sentenceEndOffset = paragraph.end;
          } else {
            if (sentenceChunk) {
              chunks.push({
                text: text.slice(sentenceStartOffset, sentenceEndOffset),
                start: sentenceStartOffset,
                end: sentenceEndOffset,
              });
            }
            sentenceChunk = remaining;
            sentenceStartOffset = paragraph.start + endOffset;
            sentenceEndOffset = paragraph.end;
          }
        }

        if (sentenceChunk) {
          chunks.push({
            text: text.slice(sentenceStartOffset, sentenceEndOffset),
            start: sentenceStartOffset,
            end: sentenceEndOffset,
          });
        }

        chunk = '';
        chunkEndOffset = 0;
      } else {
        chunk = paragraph.text;
        chunkStartOffset = paragraph.start;
        chunkEndOffset = paragraph.end;
      }
    }
  }

  if (chunk && chunkEndOffset > 0) {
    chunks.push({
      text: text.slice(chunkStartOffset, chunkEndOffset),
      start: chunkStartOffset,
      end: chunkEndOffset,
    });
  }

  const results = await pMap(
    chunks,
    async (chunk) => {
      const normalizedChunk = normalize(chunk.text);
      const hash = rapidhash(normalizedChunk.text);

      if (offlineMode) {
        const cacheKey = `spellcheck:offline:${hash}`;
        const cachedErrors = await getCachedErrors(cacheKey, cache);
        const normalizedErrors = cachedErrors ?? buildOfflineErrors(normalizedChunk.text);

        if (!cachedErrors) {
          await setCachedErrors(cacheKey, normalizedErrors, cache);
        }

        return normalizedErrors.map((error) => inflateError(error, chunk, normalizedChunk));
      }

      const cacheKey = `spellcheck:remote:${hash}`;
      let xml = await getCachedValue(cacheKey, cache);

      if (!xml) {
        try {
          xml = await fetcher(normalizedChunk.text);
          await setCachedValue(cacheKey, xml, cache);
        } catch (err) {
          Sentry.captureException(err);
          return [];
        }
      }

      return parseXmlErrors(xml, chunk, normalizedChunk);
    },
    { concurrency: MAX_CONCURRENCY },
  );

  return results.flat();
};
