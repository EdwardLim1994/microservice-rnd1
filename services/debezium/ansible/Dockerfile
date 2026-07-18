# Build context is this directory (services/debezium/ansible) — see the "debezium-ansible" service
# in services/debezium/docker-compose.yml. ansible-core alone was enough while this playbook only
# ever called Kafka Connect's REST API (via the built-in ansible.builtin.uri module) — reconciling
# a Postgres publication's table membership (tasks/main.yml) additionally needs the
# community.postgresql collection, and that collection's own postgresql_query module needs
# psycopg2 (the actual Postgres driver) installed alongside it; -binary avoids needing Postgres's
# dev headers/a C compiler in this image just to build psycopg2 from source.
FROM python:3.13-slim

RUN pip install --no-cache-dir --only-binary :all: ansible-core==2.21.2 psycopg2-binary==2.9.12

COPY requirements.yml /tmp/requirements.yml

RUN useradd --create-home --uid 1000 ansible
USER ansible

RUN ansible-galaxy collection install -r /tmp/requirements.yml

WORKDIR /workspace
