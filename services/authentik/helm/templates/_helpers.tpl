{{- define "authentik.postgresql.labels" -}}
app.kubernetes.io/name: authentik-postgresql
{{- end -}}

{{- define "authentik.redis.labels" -}}
app.kubernetes.io/name: authentik-redis
{{- end -}}

{{- define "authentik.server.labels" -}}
app.kubernetes.io/name: authentik-server
{{- end -}}

{{- define "authentik.worker.labels" -}}
app.kubernetes.io/name: authentik-worker
{{- end -}}
