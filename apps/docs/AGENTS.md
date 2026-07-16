## Development

When starting the dev server, use background mode:

```
astro dev --background
```

Manage the background server with `astro dev stop`, `astro dev status`, and `astro dev logs`.

## Docker / Kubernetes

`Dockerfile` uses `turbo prune docs --docker` (same pattern as `servers/auth/Dockerfile`) rather
than a hand-picked `COPY` subset — this repo's root `bun.lock`/`package.json` tracks every
workspace (including the literal, non-glob `"e2e"` entry), so `bun install` fails on any
workspace it can't resolve even if this app never imports it; `turbo prune` computes the correct
minimal subset automatically. Runtime stays on `oven/bun` (not a static-file server) since `astro
preview` is the Astro CLI itself, a devDependency with no standalone binary to extract — same
reasoning as `turbo/generators/templates/frontend-project-plain/Dockerfile`. Sets
`ASTRO_TELEMETRY_DISABLED=1` — the unprivileged runtime user has no writable `$HOME`, which
crashes `astro preview` outright on its first-run telemetry write otherwise.

`docker-compose.yml` registers this into the root stack via `apps/docker-compose.yml`'s
`include:` (see root `CLAUDE.md`'s Layout section) — routed through Traefik at `docs.localhost`,
same `traefik.enable=true` label convention as every other browser-facing service. `helm/` +
`terraform/` follow the exact shape `servers/auth/terraform`/`turbo/generators/templates/
frontend-deploy` already use (NodePort + Traefik `Ingress`, registered as `module "docs"` in the
root `terraform/main.tf`) — see `terraform/CLAUDE.md` for the pattern.

**`starlight-versions` is not currently configured** — it hard-requires a real snapshot for every
declared version and refuses to start with zero versions declared either, and no version snapshot
has ever actually been created for this site. Re-add it once that provisioning step is done (see
`astro.config.ts`'s comment).

## Documentation

Full documentation: https://docs.astro.build

Consult these guides before working on related tasks:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, Svelte, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Adding or managing content](https://docs.astro.build/en/guides/content-collections/)
- [Adding styles or using Tailwind](https://docs.astro.build/en/guides/styling/)
- [Supporting multiple languages](https://docs.astro.build/en/guides/internationalization/)
