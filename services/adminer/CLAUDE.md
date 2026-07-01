# services/adminer

Docker Compose entry for [Adminer](https://www.adminer.org/) — a browser-based DB admin UI, on
`:8090` (mapped from the image's `:8080`).

- Just the stock `adminer:latest` image (see `docker-compose.yml`) — there is no application code
  in this folder. `package.json`/`tsconfig.json`/`README.md` are leftovers from `bun init`
  scaffolding and don't reflect anything actually run; ignore their `bun install`/`bun run index.ts`
  instructions.
- On the `adminer` Docker network — the same network every server's Postgres container joins (e.g.
  `demo1-db`, see `servers/demo1/CLAUDE.md`), specifically so Adminer can reach them by service
  name. If a new server adds its own database, its `docker-compose.yml` must put that DB service on
  the `adminer` network too, or it won't be reachable from here.
- Login fields when connecting: System `PostgreSQL`, Server `<db-service-name>` (e.g. `demo1-db`),
  then that database's user/password/db name from its own `docker-compose.yml`/`.env`.
