# Build context is this directory (services/vault/ansible) — see the "ansible" service in
# services/vault/docker-compose.yml. Bakes ansible-core + hvac + community.hashi_vault in at
# build time so no local Python/ansible install is needed on the host; only rebuild
# (`docker compose build ansible`) when requirements.yml or this Dockerfile changes.
FROM python:3.13-slim

RUN pip install --no-cache-dir ansible-core hvac

COPY requirements.yml /tmp/requirements.yml
RUN ansible-galaxy collection install -r /tmp/requirements.yml

WORKDIR /workspace
