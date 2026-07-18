# Build context is this directory (services/authentik/ansible) — see the "authentik-ansible"
# service in services/authentik/docker-compose.yml. Only ansible-core is needed — every task in
# this role talks to Authentik's REST API via ansible.builtin.uri, which ships in ansible-core
# itself (unlike services/vault/ansible's Dockerfile, which additionally installs hvac +
# community.hashi_vault for Vault's own client library/collection). Only rebuild
# (`docker compose build authentik-ansible`) if this Dockerfile changes.
FROM python:3.13-slim

RUN pip install --no-cache-dir --only-binary :all: ansible-core==2.21.2

RUN useradd --create-home --uid 1000 ansible
USER ansible

WORKDIR /workspace
