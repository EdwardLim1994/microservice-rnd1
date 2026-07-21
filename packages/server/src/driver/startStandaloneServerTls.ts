import http from 'node:http';
import https from 'node:https';
import type { ApolloServer, BaseContext } from '@apollo/server';
import { HeaderMap } from '@apollo/server';
import { ApolloServerPluginDrainHttpServer } from '@apollo/server/plugin/drainHttpServer';
import type { TlsConfig } from '../database/VaultTlsAdapter';

export interface StandaloneServerTlsListenOptions {
  port?: number;
  host?: string;
  /** Serves over https.createServer with mTLS (requestCert + rejectUnauthorized) instead of plain http when set. */
  tls?: TlsConfig;
}

export interface StandaloneServerTlsOptions {
  listen?: StandaloneServerTlsListenOptions;
}

/**
 * A TLS-capable drop-in for @apollo/server/standalone's startStandaloneServer, which hardcodes
 * `http.createServer` with no way to pass TLS options (confirmed by reading its source). Same
 * request-handling shape (read body, executeHTTPGraphQLRequest, write response), minus
 * startStandaloneServer's cors/body-parser middleware — this listener is only ever hit
 * server-to-server (Apollo Router -> this subgraph, see services/apollo's routing_url), never
 * directly by a browser, so there's no preflight/cross-origin case to cover.
 *
 * ponytail: no cors/body-parser dependency — plain JSON body read via stdlib stream iteration.
 * Add proper CORS handling if this listener is ever addressed directly by a browser.
 */
export async function startStandaloneServerTls(
  server: ApolloServer<BaseContext>,
  options?: StandaloneServerTlsOptions,
): Promise<{ url: string }> {
  const context = async () => ({}) as BaseContext;
  const tls = options?.listen?.tls;

  const requestListener: http.RequestListener = (req, res) => {
    (async () => {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(chunk as Buffer);
      const bodyText = Buffer.concat(chunks).toString('utf-8');

      const headers = new HeaderMap();
      for (const [key, value] of Object.entries(req.headers)) {
        if (value !== undefined) {
          headers.set(key, Array.isArray(value) ? value.join(', ') : value);
        }
      }

      const httpGraphQLResponse = await server.executeHTTPGraphQLRequest({
        httpGraphQLRequest: {
          method: (req.method ?? 'GET').toUpperCase(),
          headers,
          search: req.url?.includes('?')
            ? req.url.slice(req.url.indexOf('?'))
            : '',
          body: bodyText.length > 0 ? JSON.parse(bodyText) : undefined,
        },
        context,
      });

      for (const [key, value] of httpGraphQLResponse.headers) {
        res.setHeader(key, value);
      }
      res.statusCode = httpGraphQLResponse.status ?? 200;
      if (httpGraphQLResponse.body.kind === 'complete') {
        res.end(httpGraphQLResponse.body.string);
        return;
      }
      for await (const chunk of httpGraphQLResponse.body.asyncIterator) {
        res.write(chunk);
      }
      res.end();
    })().catch((err) => {
      res.statusCode = 500;
      res.end(err instanceof Error ? err.message : 'Internal server error');
    });
  };

  const httpServer = tls
    ? https.createServer(
        {
          ca: tls.ca,
          cert: tls.cert,
          key: tls.key,
          requestCert: true,
          rejectUnauthorized: true,
        },
        requestListener,
      )
    : http.createServer(requestListener);

  server.addPlugin(ApolloServerPluginDrainHttpServer({ httpServer }));
  await server.start();

  const listenOptions = {
    port: options?.listen?.port ?? 4000,
    host: options?.listen?.host,
  };
  await new Promise<void>((resolve) => {
    httpServer.listen(listenOptions, resolve);
  });

  const address = httpServer.address();
  const port =
    typeof address === 'object' && address ? address.port : listenOptions.port;
  const scheme = tls ? 'https' : 'http';
  return { url: `${scheme}://${listenOptions.host}:${port}/` };
}
