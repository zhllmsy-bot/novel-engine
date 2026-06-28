import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldTitle,
} from '@/components/ui/field'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import {
  auditProviderConfig,
  providerConfigFieldLabels,
} from '@/ai/providerRuntime'
import type { ProviderConfig } from '@/ai/providerRuntime'
import type {
  ProviderAdapterManifest,
  ProviderConfigField,
} from '@/ai/providerManifest'
import { InspectorSection } from './components'
import type { ProviderPanelProps } from './types'

const providerFieldInputTypes: Record<ProviderConfigField, string> = {
  baseUrl: 'url',
  model: 'text',
  apiKey: 'password',
}

const providerFieldPlaceholders: Record<ProviderConfigField, string> = {
  baseUrl: 'http://127.0.0.1:8000',
  model: 'gpt-4.1-mini',
  apiKey: 'sk-...',
}

const providerStatusLabel: Record<ProviderAdapterManifest['status'], string> = {
  available: 'available',
  configured: 'configured',
  planned: 'planned',
}

function providerStatusVariant(status: ProviderAdapterManifest['status']) {
  return status === 'planned' ? 'outline' : 'secondary'
}

export function ProviderPanel({
  providerMode,
  providerConfig,
  providerAdapters,
  providerAdapterErrors,
  onProviderModeChange,
  onProviderConfigChange,
}: ProviderPanelProps) {
  const activeAdapter =
    providerAdapters.find((adapter) => adapter.id === providerMode) ||
    providerAdapters[0]
  const configAudit = activeAdapter
    ? auditProviderConfig(activeAdapter.id, providerConfig, providerAdapters)
    : null

  return (
    <InspectorSection title="模型配置">
      <FieldGroup
        className="provider-panel"
        onSubmit={(event) => event.preventDefault()}
        asForm
      >
        <Field>
          <FieldTitle id="provider-mode-label">模式</FieldTitle>
          <ToggleGroup
            aria-labelledby="provider-mode-label"
            className="provider-toggle"
            onValueChange={(value) => {
              if (providerAdapters.some((adapter) => adapter.id === value)) {
                onProviderModeChange(value)
              }
            }}
            spacing={0}
            type="single"
            value={providerMode}
            variant="outline"
          >
            {providerAdapters.map((adapter) => (
              <ToggleGroupItem key={adapter.id} value={adapter.id}>
                <span>{adapter.label}</span>
                {adapter.sourceKind ? <small>{adapter.sourceKind}</small> : null}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </Field>
        {activeAdapter ? (
          <div
            className="provider-adapter-card"
            aria-label="Provider adapter contract"
          >
            <div className="provider-adapter-heading">
              <span>{activeAdapter.label}</span>
              <span className="provider-adapter-badges">
                <Badge
                  className={`provider-adapter-status ${activeAdapter.status}`}
                  variant={providerStatusVariant(activeAdapter.status)}
                >
                  {providerStatusLabel[activeAdapter.status]}
                </Badge>
                <Badge variant="outline">{activeAdapter.kind}</Badge>
                {activeAdapter.sourceKind ? (
                  <Badge variant="outline">{activeAdapter.sourceKind}</Badge>
                ) : null}
              </span>
            </div>
            <p>{activeAdapter.description}</p>
            <dl className="provider-contract-grid">
              <div>
                <dt>manifest</dt>
                <dd>{activeAdapter.path || 'bundled'}</dd>
              </div>
              <div>
                <dt>config fields</dt>
                <dd>
                  {activeAdapter.configFields.length > 0
                    ? activeAdapter.configFields.join(', ')
                    : 'none'}
                </dd>
              </div>
              <div>
                <dt>capabilities</dt>
                <dd>
                  <ul className="adapter-capabilities">
                    {activeAdapter.capabilities.map((capability) => (
                      <li key={capability}>{capability}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            </dl>
          </div>
        ) : null}
        {activeAdapter?.configFields.map((field) => (
          <ProviderConfigInput
            field={field}
            key={field}
            providerConfig={providerConfig}
            onProviderConfigChange={onProviderConfigChange}
          />
        ))}
        {activeAdapter && activeAdapter.configFields.length > 0 ? (
          <Field>
            <FieldDescription>
              Base URL 和 Model 会保留在本机设置；API Key 只保留当前会话，不写入持久化存储。
            </FieldDescription>
          </Field>
        ) : null}
        <div className="provider-config-audit" aria-label="Provider config audit">
          <div className="provider-config-audit-heading">
            <span>配置审计</span>
            <Badge variant={configAudit?.ready ? 'secondary' : 'outline'}>
              {configAudit?.ready ? 'ready' : 'missing'}
            </Badge>
          </div>
          {configAudit && configAudit.requiredFields.length > 0 ? (
            <div className="provider-config-fields">
              {configAudit.requiredFields.map((field) => (
                <span
                  className={field.ready ? 'is-ready' : 'is-missing'}
                  key={field.field}
                >
                  <strong>{field.label}</strong>
                  <small>{field.ready ? 'ready' : 'missing'}</small>
                </span>
              ))}
            </div>
          ) : (
            <p>该 Provider 不需要本地凭据配置。</p>
          )}
        </div>
        {providerAdapterErrors.length > 0 ? (
          <div className="provider-adapter-errors" role="status">
            {providerAdapterErrors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        ) : null}
        <code className="adapter-scaffold-command">
          npm run adapters:new -- --type provider --project &lt;novel-project&gt; --id
          local-qwen --name "Local Qwen" --provider-kind local
        </code>
      </FieldGroup>
    </InspectorSection>
  )
}

function ProviderConfigInput({
  field,
  providerConfig,
  onProviderConfigChange,
}: {
  field: ProviderConfigField
  providerConfig: ProviderConfig
  onProviderConfigChange: (config: ProviderConfig) => void
}) {
  const fieldId = `provider-${field}`

  return (
    <Field>
      <FieldLabel htmlFor={fieldId}>{providerConfigFieldLabels[field]}</FieldLabel>
      <Input
        autoComplete="off"
        id={fieldId}
        name={fieldId}
        onChange={(event) =>
          onProviderConfigChange({
            ...providerConfig,
            [field]: event.target.value,
          })
        }
        placeholder={providerFieldPlaceholders[field]}
        spellCheck={false}
        type={providerFieldInputTypes[field]}
        value={providerConfig[field]}
      />
    </Field>
  )
}
