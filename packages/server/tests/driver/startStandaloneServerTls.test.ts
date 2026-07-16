import https from 'node:https';
import { ApolloServer } from '@apollo/server';
import { afterAll, beforeAll, expect, test } from '@rstest/core';
import { startStandaloneServerTls } from '../../src/driver/startStandaloneServerTls';
import { makeTestPki } from '../helpers/selfSignedCerts';

// this is the one runnable check that `requestCert + rejectUnauthorized` actually enforces mTLS,
// since startStandaloneServer's own tests never exercise this fork's https.createServer path
// (they inject a mock startServer instead — see ApolloDriver.test.ts).
let caCert: string;
let serverKey: string;
let serverCert: string;
let clientKey: string;
let clientCert: string;
let baseUrl: URL;
let apolloServer: ApolloServer;

beforeAll(async () => {
  const pki = makeTestPki();
  caCert = pki.ca.cert;
  serverKey = pki.server.key;
  serverCert = pki.server.cert;
  clientKey = pki.client.key;
  clientCert = pki.client.cert;

  apolloServer = new ApolloServer({
    typeDefs: 'type Query { hello: String }',
    resolvers: { Query: { hello: () => 'world' } },
  });

  const { url } = await startStandaloneServerTls(apolloServer, {
    listen: {
      port: 0,
      host: 'localhost',
      tls: {
        ca: Buffer.from(caCert),
        cert: Buffer.from(serverCert),
        key: Buffer.from(serverKey),
      },
    },
  });
  baseUrl = new URL(url);
});

afterAll(async () => {
  await apolloServer.stop();
});

function query(withClientCert: boolean): Promise<{ status?: number; error?: Error }> {
  return new Promise((resolve) => {
    const req = https.request(
      {
        hostname: baseUrl.hostname,
        port: baseUrl.port,
        path: '/',
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        ca: caCert,
        ...(withClientCert ? { cert: clientCert, key: clientKey } : {}),
      },
      (res) => {
        res.on('data', () => {});
        res.on('end', () => resolve({ status: res.statusCode }));
      },
    );
    req.on('error', (error) => resolve({ error }));
    req.end(JSON.stringify({ query: '{ hello }' }));
  });
}

test('accepts a request presenting a CA-signed client cert', async () => {
  const { status, error } = await query(true);
  expect(error).toBeUndefined();
  expect(status).toBe(200);
});

test('rejects a request with no client cert', async () => {
  const { error } = await query(false);
  expect(error).toBeDefined();
});
