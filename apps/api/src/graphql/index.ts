import { useOpenTelemetry } from '@envelop/opentelemetry';
import { trace } from '@opentelemetry/api';
import { createYoga, useExecutionCancellation } from 'graphql-yoga';
import { Hono } from 'hono';
import { useError } from './plugins/error';
import { useLogger } from './plugins/logger';
import { schema } from './schema';
import type { Env, ServerContext, UserContext } from '@/context';

export const graphql = new Hono<Env>();

const app = createYoga<{ c: ServerContext }, UserContext>({
  schema,
  context: ({ c }) => ({ c, ...c.get('context') }),
  graphqlEndpoint: '/graphql',
  batching: true,
  cors: false,
  maskedErrors: false,
  landingPage: false,
  plugins: [
    useExecutionCancellation(),
    useLogger(),
    useError(),
    useOpenTelemetry(
      {
        document: false,
        resolvers: true,
      },
      trace.getTracerProvider(),
    ),
  ],
});

graphql.on(['GET', 'POST'], '/', async (c) => {
  const response = await app.handle(c.req.raw, { c });
  return c.newResponse(response.body, response);
});
