{{- define "mantis.name" -}}
{{- default .Chart.Name .Values.global.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "mantis.fullname" -}}
{{- if .Values.global.fullnameOverride -}}
{{- .Values.global.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.global.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{- define "mantis.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "mantis.labels" -}}
helm.sh/chart: {{ include "mantis.chart" . }}
app.kubernetes.io/name: {{ include "mantis.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- if .Chart.AppVersion }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
{{- end -}}
{{- end -}}

{{- define "mantis.selectorLabels" -}}
app.kubernetes.io/name: {{ include "mantis.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "mantis.secretName" -}}
{{- default (printf "%s-secrets" (include "mantis.fullname" .)) .Values.global.secretName -}}
{{- end -}}

{{- define "mantis.configName" -}}
{{- default (printf "%s-config" (include "mantis.fullname" .)) .Values.global.configName -}}
{{- end -}}

{{- define "mantis.imagePullSecrets" -}}
{{- with .Values.global.imagePullSecrets }}
imagePullSecrets:
{{- toYaml . | nindent 2 }}
{{- end }}
{{- end -}}

{{- define "mantis.appName" -}}
{{- $ctx := .ctx -}}
{{- $app := .app -}}
{{- printf "%s-%s" (include "mantis.fullname" $ctx) $app | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "mantis.appServiceName" -}}
{{- $ctx := .ctx -}}
{{- $app := .app -}}
{{- $cfg := .cfg -}}
{{- if $cfg.serviceName -}}
{{- $cfg.serviceName -}}
{{- else -}}
{{- $app -}}
{{- end -}}
{{- end -}}

{{- define "mantis.databaseUrl" -}}
postgres://$(POSTGRES_USER):$(POSTGRES_PASSWORD)@$(POSTGRES_HOST):$(POSTGRES_PORT)/$(POSTGRES_DB)?sslmode=$(POSTGRES_SSLMODE)
{{- end -}}

{{- define "mantis.commonEnv" -}}
- name: TZ
  value: {{ .Values.global.timezone | default "UTC" | quote }}
- name: PORT
  valueFrom:
    configMapKeyRef:
      name: {{ include "mantis.configName" . }}
      key: PORT
- name: ATTACHMENT_DIR
  valueFrom:
    configMapKeyRef:
      name: {{ include "mantis.configName" . }}
      key: ATTACHMENT_DIR
- name: POSTGRES_HOST
  valueFrom:
    configMapKeyRef:
      name: {{ include "mantis.configName" . }}
      key: POSTGRES_HOST
- name: POSTGRES_PORT
  valueFrom:
    configMapKeyRef:
      name: {{ include "mantis.configName" . }}
      key: POSTGRES_PORT
- name: POSTGRES_SSLMODE
  valueFrom:
    configMapKeyRef:
      name: {{ include "mantis.configName" . }}
      key: POSTGRES_SSLMODE
- name: POSTGRES_USER
  valueFrom:
    secretKeyRef:
      name: {{ include "mantis.secretName" . }}
      key: POSTGRES_USER
- name: POSTGRES_PASSWORD
  valueFrom:
    secretKeyRef:
      name: {{ include "mantis.secretName" . }}
      key: POSTGRES_PASSWORD
- name: POSTGRES_DB
  valueFrom:
    secretKeyRef:
      name: {{ include "mantis.secretName" . }}
      key: POSTGRES_DB
- name: DATABASE_URL
  value: {{ include "mantis.databaseUrl" . | quote }}
- name: AUTH_USER_NAME
  valueFrom:
    configMapKeyRef:
      name: {{ include "mantis.configName" . }}
      key: AUTH_USER_NAME
- name: AUTH_RATE_LIMIT_MAX
  valueFrom:
    configMapKeyRef:
      name: {{ include "mantis.configName" . }}
      key: AUTH_RATE_LIMIT_MAX
- name: AUTH_RATE_LIMIT_WINDOW
  valueFrom:
    configMapKeyRef:
      name: {{ include "mantis.configName" . }}
      key: AUTH_RATE_LIMIT_WINDOW
- name: AUTH_TOKEN
  valueFrom:
    secretKeyRef:
      name: {{ include "mantis.secretName" . }}
      key: AUTH_TOKEN
      optional: true
- name: MANTIS_LLM_BASE_URL
  valueFrom:
    configMapKeyRef:
      name: {{ include "mantis.configName" . }}
      key: MANTIS_LLM_BASE_URL
- name: MANTIS_LLM_MODEL
  valueFrom:
    configMapKeyRef:
      name: {{ include "mantis.configName" . }}
      key: MANTIS_LLM_MODEL
- name: MANTIS_TG_USER_IDS
  valueFrom:
    configMapKeyRef:
      name: {{ include "mantis.configName" . }}
      key: MANTIS_TG_USER_IDS
- name: MANTIS_LLM_API_KEY
  valueFrom:
    secretKeyRef:
      name: {{ include "mantis.secretName" . }}
      key: MANTIS_LLM_API_KEY
      optional: true
- name: MANTIS_TG_BOT_TOKEN
  valueFrom:
    secretKeyRef:
      name: {{ include "mantis.secretName" . }}
      key: MANTIS_TG_BOT_TOKEN
      optional: true
- name: ASR_API_URL
  valueFrom:
    configMapKeyRef:
      name: {{ include "mantis.configName" . }}
      key: ASR_API_URL
- name: OCR_API_URL
  valueFrom:
    configMapKeyRef:
      name: {{ include "mantis.configName" . }}
      key: OCR_API_URL
- name: TTS_API_URL
  valueFrom:
    configMapKeyRef:
      name: {{ include "mantis.configName" . }}
      key: TTS_API_URL
- name: MANTIS_SUPERVISOR_TIMEOUT
  valueFrom:
    configMapKeyRef:
      name: {{ include "mantis.configName" . }}
      key: MANTIS_SUPERVISOR_TIMEOUT
      optional: true
- name: MANTIS_SERVER_TIMEOUT
  valueFrom:
    configMapKeyRef:
      name: {{ include "mantis.configName" . }}
      key: MANTIS_SERVER_TIMEOUT
      optional: true
- name: MANTIS_PLAN_STEP_TIMEOUT
  valueFrom:
    configMapKeyRef:
      name: {{ include "mantis.configName" . }}
      key: MANTIS_PLAN_STEP_TIMEOUT
      optional: true
- name: GONKA_DEFAULT_NODE_URL
  valueFrom:
    configMapKeyRef:
      name: {{ include "mantis.configName" . }}
      key: GONKA_DEFAULT_NODE_URL
- name: GONKA_NODE_URL
  valueFrom:
    configMapKeyRef:
      name: {{ include "mantis.configName" . }}
      key: GONKA_NODE_URL
- name: GONKA_PIN_ENDPOINT_ENABLED
  valueFrom:
    configMapKeyRef:
      name: {{ include "mantis.configName" . }}
      key: GONKA_PIN_ENDPOINT_ENABLED
- name: GONKA_PRIVATE_KEY
  valueFrom:
    secretKeyRef:
      name: {{ include "mantis.secretName" . }}
      key: GONKA_PRIVATE_KEY
      optional: true
{{- end -}}
