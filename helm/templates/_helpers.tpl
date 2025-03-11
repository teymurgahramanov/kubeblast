{{- define "jrunner.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "jrunner.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{- define "jrunner.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "jrunner.labels" -}}
helm.sh/chart: {{ include "jrunner.chart" . }}
app.kubernetes.io/name: {{ include "jrunner.fullname" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "jrunner-api.resourceName" -}}
{{ include "jrunner.fullname" . }}-api
{{- end }}

{{- define "jrunner-worker.resourceName" -}}
{{ include "jrunner.fullname" . }}-worker
{{- end }}

{{- define "jrunner-web.resourceName" -}}
{{ include "jrunner.fullname" . }}-web
{{- end }}

{{- define "jrunner-api.selectorLabels" -}}
jrunner/component: api
{{- end }}

{{- define "jrunner-web.selectorLabels" -}}
jrunner/component: web
{{- end }}