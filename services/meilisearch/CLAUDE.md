
# services/meilisearch

Docker Compose stack: `meilisearch` (single instance, master-key protected). No separate admin
UI container, unlike `services/redis`'s `redisinsight` — `MEILI_ENV=development` enables
Meilisearch's own built-in web dashboard, served directly from the same container at `:7700`.

- Auth is a **master key**, not embedded in a connection URL like Redis's `redis://:pass@host` —
  any client, including `server`'s `MeilisearchPlugin` (see `packages/server/CLAUDE.md`), sends it
  as an `Authorization: Bearer <key>` HTTP header (handled internally by the official `meilisearch`
  npm client's `apiKey` constructor option), not part of the host URL.
- `MEILI_ENV=development` is what actually enables the dashboard and relaxes some production
  safety checks (e.g. allows the API to respond even without a key configured) — deliberately not
  `production`, since this stack is for local/dev use only, same as every other `services/*` stack
  in this repo.
- Has a Docker healthcheck (`wget --spider http://localhost:7700/health`) — a container being *up*
  isn't the same as Meilisearch being ready to accept requests. Anything depending on it should use
  `depends_on: meilisearch: condition: service_healthy`, not just `depends_on: meilisearch` (same
  reasoning as `services/redis/CLAUDE.md`'s and `services/kafka/CLAUDE.md`'s healthcheck notes).
- `meilisearch` has its own dedicated bridge network (`networks: - meilisearch`) — a service with
  no explicit `networks:` entry lands on Compose's implicit default network instead, a silent split
  documented as a real gotcha in `services/redis/CLAUDE.md` (bit that stack once already for its
  UI container) — applied here defensively from the start.
- The `meilisearch-data` named volume is scoped by Compose **project name**, same as
  `services/redis/CLAUDE.md`'s note on `redis-data` — running `docker compose up` from inside
  `services/meilisearch/` directly creates a different project/volume/network than running it via
  the root `docker-compose.yml`'s `include:`. Always bring this stack up via the root
  `docker-compose.yml` if a server needs to reach it, not standalone.
- Image is pinned to an exact tag (`getmeili/meilisearch:v1.14`), unlike `services/redis`'s
  `latest` (a documented one-off RDB-format-compatibility exception) — verify this is still the
  current stable release tag before relying on it long-term.

There is no application code in this folder — just the Docker Compose stack above, same as
`services/redis`, `services/kafka`, `services/adminer`, and `services/apollo`.
