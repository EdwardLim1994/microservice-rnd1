
# services/redis

Docker Compose stack: `redis` (single instance, password-protected) and `redis-commander`
(browser UI on `:8091`).

- `redis` requires auth (`command: redis-server --requirepass redispassword`) — any client,
  including `server`'s `RedisPlugin` (see `packages/server/CLAUDE.md`), needs the password embedded in
  its connection URL (`redis://:redispassword@<host>:6379`), not a separate config field.
- `redis` has a Docker healthcheck (`redis-cli -a redispassword ping | grep -q PONG`) — a container
  being *up* isn't the same as Redis being ready to accept auth'd connections. Anything depending on
  it should use `depends_on: redis: condition: service_healthy`, not just `depends_on: redis` (same
  reasoning as `services/kafka/CLAUDE.md`'s Kafka healthcheck note).
- `redis-commander` **must** share the `redis` network to resolve the `redis` hostname in its
  `REDIS_HOSTS=local:redis:6379:0:redispassword` env var — a service in this file with no explicit
  `networks:` entry lands on Compose's implicit default network instead, a silent split that leaves
  the UI unable to connect at all (this bit us once already: the fix was adding `networks: - redis`
  to `redis-commander`, it isn't automatic just because both services live in the same file).
- The `redis-data` named volume is scoped by Compose **project name**, which is derived from
  whatever directory you run `docker compose` from (or `-p`/`name:` override) — running
  `docker compose up` from inside `services/redis/` directly creates project `redis` (network
  `redis_redis`, volume `redis_redis-data`), which is a **different** network/volume than running it
  as part of the root `docker-compose.yml`'s `include:` (project `microservice-rnd1`, network
  `microservice-rnd1_redis`). A server only joins the latter — if `redis` was started
  standalone from this directory, that server can't reach it even with correct env vars/networks on
  its own side. Always bring this stack up via the root `docker-compose.yml` if a server needs to
  reach it, not standalone.
- Image is intentionally **not** pinned to `latest` in principle (every other stateful service in
  this repo pins an exact tag, e.g. `postgres:15.3-alpine`, `confluentinc/cp-kafka:8.2.2`) — it's
  currently on `redis:latest` only because the `redis-data` volume already had an RDB file written
  by a newer Redis major version than `7.0.11`, and Redis can't load a newer RDB format on
  downgrade (`Can't handle RDB format version 14`). Pin to a specific version only after wiping/
  recreating `redis-data`, otherwise the container will crash-loop on that same RDB error.

There is no application code in this folder — just the Docker Compose stack above, same as
`services/kafka`, `services/adminer`, and `services/apollo`.
