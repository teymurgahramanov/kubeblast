{{- define "kubeblast.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "kubeblast.fullname" -}}
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

{{/*
Return the name used by the Bitnami MongoDB dependency.
*/}}
{{- define "kubeblast.mongodbFullname" -}}
{{- if .Values.mongodb.fullnameOverride }}
{{- .Values.mongodb.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default "mongodb" .Values.mongodb.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Return the MongoDB Service name, respecting the subchart override.
*/}}
{{- define "kubeblast.mongodbServiceName" -}}
{{- if .Values.mongodb.service.nameOverride }}
{{- .Values.mongodb.service.nameOverride }}
{{- else }}
{{- include "kubeblast.mongodbFullname" . }}
{{- end }}
{{- end }}

{{/*
Return the Secret containing the MongoDB custom-user passwords.
*/}}
{{- define "kubeblast.mongodbSecretName" -}}
{{- if .Values.mongodb.auth.existingSecret }}
{{- .Values.mongodb.auth.existingSecret }}
{{- else }}
{{- include "kubeblast.mongodbFullname" . }}
{{- end }}
{{- end }}

{{- define "kubeblast.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{- define "kubeblast.labels" -}}
helm.sh/chart: {{ include "kubeblast.chart" . }}
app.kubernetes.io/name: {{ include "kubeblast.fullname" . }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{- define "kubeblast.selectorLabels" -}}
app.kubernetes.io/name: {{ include "kubeblast.fullname" . }}
{{- end }}

{{/*
Return the PVC name to use
*/}}
{{- define "kubeblast.pvcName" -}}
{{- if .Values.pvc.existingClaim }}
{{- .Values.pvc.existingClaim }}
{{- else }}
{{- include "kubeblast.fullname" . }}
{{- end }}
{{- end }}