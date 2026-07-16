
# services/minio

Docker Compose stack: `minio` (single instance, root-credential protected). No separate admin UI
container, unlike `services/redis`'s `redisinsight` — MinIO's own binary serves its built-in web
console directly from the same container at `:9001` (`--console-address ":9001"`), same reasoning
as `services/meilisearch`'s built-in dashboard.

- Auth is a **root user/password pair** (`MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`), not a single
  master key like Meilisearch — any client, including `server`'s `MinioPlugin` (see
  `packages/server/CLAUDE.md`), authenticates via MinIO's S3-compatible signed-request scheme
  (`accessKey`/`secretKey`, handled internally by the official `minio` npm client), not a bearer
  token or connection-string password.
- Two ports: `9000` is the S3 API (what `MinioPlugin` and any other S3 client talk to), `9001` is
  the web console. Only the console is fronted by Traefik (`minio.localhost`, in both
  docker-compose and the Kubernetes chart's `Ingress`) — the API port is reached directly by
  servers over the Docker network/`host.minikube.internal`/in-cluster Service, same as how
  Meilisearch's dashboard is the only thing exposed for that service, not its API port under a
  different host.
- **Unlike Meilisearch's dashboard, the console *is* exposed via a Kubernetes `Ingress`**
  (`helm/templates/ingress.yaml`, `minio.localhost`) — same treatment as Grafana
  (`services/monitoring/CLAUDE.md`), since MinIO's console gates itself with its own root-user
  login rather than relying on Traefik's docker-compose-only `admin-auth` middleware (no
  equivalent Middleware CRD exists in-cluster — see `services/traefik/CLAUDE.md`'s Kubernetes
  section).
- Has a Docker healthcheck (`curl -f http://localhost:9000/minio/health/live`) — a container being
  *up* isn't the same as MinIO being ready to accept requests. Anything depending on it should use
  `depends_on: minio: condition: service_healthy`, not just `depends_on: minio` (same reasoning as
  `services/redis/CLAUDE.md`'s and `services/kafka/CLAUDE.md`'s healthcheck notes).
- `minio` has its own dedicated bridge network (`networks: - minio`) — a service with no explicit
  `networks:` entry lands on Compose's implicit default network instead, a silent split documented
  as a real gotcha in `services/redis/CLAUDE.md` — applied here defensively from the start.
- The `minio-data` named volume is scoped by Compose **project name**, same as
  `services/redis/CLAUDE.md`'s note on `redis-data` — running `docker compose up` from inside
  `services/minio/` directly creates a different project/volume/network than running it via the
  root `docker-compose.yml`'s `include:`. Always bring this stack up via the root
  `docker-compose.yml` if a server needs to reach it, not standalone.
- Image is pinned to an exact tag (`quay.io/minio/minio:RELEASE.2025-04-08T15-41-24Z`), same
  reasoning as `services/meilisearch`'s pinned tag — verify this is still a current release
  before relying on it long-term.

There is no application code in this folder — just the Docker Compose stack above, same as
`services/redis`, `services/meilisearch`, `services/kafka`, `services/adminer`, and
`services/apollo`.
