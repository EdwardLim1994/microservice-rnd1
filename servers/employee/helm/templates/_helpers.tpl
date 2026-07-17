{{- define "server.fullname" -}}
{{- .Release.Name -}}
{{- end -}}

{{- define "server.labels" -}}
app.kubernetes.io/name: {{ include "server.fullname" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}
