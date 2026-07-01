
# services/kafka

Docker Compose stack: `kafka` (KRaft mode, single broker), `kafka-ui` (browser UI on `:8080`),
`schema-registry` (Confluent Schema Registry on `:8081`).

- `kafka` has two listeners: `PLAINTEXT` (`kafka:9092`, internal Docker network — what other
  containers must use) and `PLAINTEXT_HOST` (`localhost:29092`, host-machine access — what a
  locally-run `bun run index.ts` server must use). Mixing them (e.g. `kafka:29092`) half-works at
  best — the broker's metadata response for that port still advertises `localhost:29092`, so clients
  reconnect there and fail once inside a container.
- `kafka` and `schema-registry` both have Docker healthchecks
  (`kafka-broker-api-versions --bootstrap-server localhost:9092` / `curl .../subjects`) — a
  container being *up* isn't the same as the broker being *ready to serve requests*. Any service
  that depends on either should use `depends_on: <service>: condition: service_healthy`, not just
  `depends_on: <service>` (which only waits for the container to start, not warm up) — see
  `servers/demo1/docker-compose.yml` / `servers/demo2/docker-compose.yml` for the pattern.
- Topics are provisioned by `lib`'s `KafkaDriver` (via `kafka.admin().createTopics()`, idempotent)
  before any producer/consumer connects — not by `KAFKA_AUTO_CREATE_TOPICS_ENABLE` alone, which
  races a consumer's first `subscribe()` and can crash it (`UNKNOWN_TOPIC_OR_PARTITION`) before the
  broker finishes auto-creating. See `packages/lib/CLAUDE.md`'s KafkaDriver section.

Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun build <file.html|file.ts|file.css>` instead of `webpack` or `esbuild`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

## APIs

- `Bun.serve()` supports WebSockets, HTTPS, and routes. Don't use `express`.
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.redis` for Redis. Don't use `ioredis`.
- `Bun.sql` for Postgres. Don't use `pg` or `postgres.js`.
- `WebSocket` is built-in. Don't use `ws`.
- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

## Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Frontend

Use HTML imports with `Bun.serve()`. Don't use `vite`. HTML imports fully support React, CSS, Tailwind.

Server:

```ts#index.ts
import index from "./index.html"

Bun.serve({
  routes: {
    "/": index,
    "/api/users/:id": {
      GET: (req) => {
        return new Response(JSON.stringify({ id: req.params.id }));
      },
    },
  },
  // optional websocket support
  websocket: {
    open: (ws) => {
      ws.send("Hello, world!");
    },
    message: (ws, message) => {
      ws.send(message);
    },
    close: (ws) => {
      // handle close
    }
  },
  development: {
    hmr: true,
    console: true,
  }
})
```

HTML files can import .tsx, .jsx or .js files directly and Bun's bundler will transpile & bundle automatically. `<link>` tags can point to stylesheets and Bun's CSS bundler will bundle.

```html#index.html
<html>
  <body>
    <h1>Hello, world!</h1>
    <script type="module" src="./frontend.tsx"></script>
  </body>
</html>
```

With the following `frontend.tsx`:

```tsx#frontend.tsx
import React from "react";
import { createRoot } from "react-dom/client";

// import .css files directly and it works
import './index.css';

const root = createRoot(document.body);

export default function Frontend() {
  return <h1>Hello, world!</h1>;
}

root.render(<Frontend />);
```

Then, run index.ts

```sh
bun --hot ./index.ts
```

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.
