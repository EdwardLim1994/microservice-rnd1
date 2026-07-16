import * as grpc from '@grpc/grpc-js';
import { afterAll, beforeAll, expect, test } from '@rstest/core';
import { BaseRouter } from '../../src/abstract/BaseRouter';
import { GrpcDriver } from '../../src/driver/GrpcDriver';
import { makeTestPki } from '../helpers/selfSignedCerts';

// Real end-to-end check that GrpcDriver's ServerCredentials.createSsl(..., true) actually
// enforces mTLS — GrpcDriver.test.ts only asserts the credentials object's _isSecure() flag
// against a mocked server, never a live network round-trip.
const echoService: grpc.ServiceDefinition = {
  echo: {
    path: '/test.Echo/Echo',
    requestStream: false,
    responseStream: false,
    requestSerialize: (v: { msg: string }) => Buffer.from(JSON.stringify(v)),
    requestDeserialize: (buf: Buffer) => JSON.parse(buf.toString()),
    responseSerialize: (v: { msg: string }) => Buffer.from(JSON.stringify(v)),
    responseDeserialize: (buf: Buffer) => JSON.parse(buf.toString()),
  },
};

class EchoRouter extends BaseRouter {
  register(server: grpc.Server) {
    server.addService(echoService, {
      echo: (
        call: grpc.ServerUnaryCall<{ msg: string }, { msg: string }>,
        callback: grpc.sendUnaryData<{ msg: string }>,
      ) => callback(null, { msg: call.request.msg }),
    });
  }
}

const PORT = 54331;
let driver: GrpcDriver;
let caCert: string;
let clientKey: string;
let clientCert: string;

beforeAll(async () => {
  const pki = makeTestPki();
  caCert = pki.ca.cert;
  clientKey = pki.client.key;
  clientCert = pki.client.cert;

  driver = new GrpcDriver({
    tls: {
      ca: Buffer.from(caCert),
      cert: Buffer.from(pki.server.cert),
      key: Buffer.from(pki.server.key),
    },
  });
  await driver.start({
    port: PORT,
    host: '0.0.0.0',
    routers: [new EchoRouter({})],
    interceptors: [],
    plugins: [],
  });
});

afterAll(async () => {
  await driver.stop();
});

function callEcho(
  creds: grpc.ChannelCredentials,
): Promise<{ ok: boolean; error?: Error }> {
  return new Promise((resolve) => {
    const ClientCtor = grpc.makeGenericClientConstructor(echoService, 'Echo');
    const client = new ClientCtor(`localhost:${PORT}`, creds);
    client.echo({ msg: 'hi' }, (err: Error | null) => {
      client.close();
      resolve(err ? { ok: false, error: err } : { ok: true });
    });
  });
}

test('accepts a call presenting a CA-signed client cert', async () => {
  const creds = grpc.credentials.createSsl(
    Buffer.from(caCert),
    Buffer.from(clientKey),
    Buffer.from(clientCert),
  );
  const { ok, error } = await callEcho(creds);
  expect(error).toBeUndefined();
  expect(ok).toBe(true);
});

test('rejects a call with no client cert', async () => {
  const creds = grpc.credentials.createSsl(Buffer.from(caCert));
  const { ok } = await callEcho(creds);
  expect(ok).toBe(false);
});
