{{- define "kafka.labels" -}}
app.kubernetes.io/name: kafka
{{- end -}}

{{- define "schemaRegistry.labels" -}}
app.kubernetes.io/name: schema-registry
{{- end -}}
