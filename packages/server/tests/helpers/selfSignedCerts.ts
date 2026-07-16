import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export interface CertPair {
  key: string;
  cert: string;
}

/** Real self-signed CA + leaf certs via openssl (no new npm dep — same ambient tool this repo already relies on, e.g. services/traefik/CLAUDE.md's `openssl passwd -apr1`). */
export function makeTestPki() {
  const dir = mkdtempSync(join(tmpdir(), 'mtls-test-'));
  function openssl(args: string[]) {
    execFileSync('openssl', args, { cwd: dir });
  }
  function makeCert(name: string, cn: string, ca?: CertPair): CertPair {
    openssl(['genrsa', '-out', `${name}.key`, '2048']);
    if (!ca) {
      openssl([
        'req', '-x509', '-new', '-key', `${name}.key`, '-out', `${name}.crt`,
        '-days', '1', '-subj', `/CN=${cn}`,
      ]);
      return { key: `${name}.key`, cert: `${name}.crt` };
    }
    openssl([
      'req', '-new', '-key', `${name}.key`, '-out', `${name}.csr`, '-subj', `/CN=${cn}`,
    ]);
    openssl([
      'x509', '-req', '-in', `${name}.csr`, '-CA', ca.cert, '-CAkey', ca.key,
      '-CAcreateserial', '-out', `${name}.crt`, '-days', '1',
    ]);
    return { key: `${name}.key`, cert: `${name}.crt` };
  }
  function read(name: CertPair) {
    return {
      key: readFileSync(join(dir, name.key), 'utf-8'),
      cert: readFileSync(join(dir, name.cert), 'utf-8'),
    };
  }

  const caPair = makeCert('ca', 'test-ca');
  const ca = { cert: join(dir, caPair.cert), key: join(dir, caPair.key) };
  const server = read(makeCert('server', 'localhost', ca));
  const client = read(makeCert('client', 'test-client', ca));

  return { ca: read(caPair), server, client };
}
