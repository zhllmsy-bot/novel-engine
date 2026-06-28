import { useMemo, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from '@/components/ui/alert'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group'
import {
  agentReadActions,
  agentRiskLabel,
  agentReviewActions,
  agentToolCount,
  countAgentToolsByRisk,
  formatAgentToolInput,
  formatAgentToolResultSummary,
} from './agentToolDisplay'
import type { SkillManifest } from '@/types/domain'
import type { SkillRunAudit } from '@/skills/skillRuntime'
import {
  describeSkillCatalogSource,
  filterSkillCatalogEntriesBySource,
  formatSkillCatalogSource,
  summarizeSkillCatalogSources,
  type SkillCatalogEntry,
  type SkillCatalogSourceFilter,
} from '@/skills/skillCatalog'
import { InspectorSection } from './components'
import {
  isCharacterStateProposal,
  isPlotThreadProposal,
  plotThreadProposalKey,
  stateProposalKey,
} from './proposalKeys'
import type { SkillsPanelProps } from './types'

function joinAuditItems(items: Array<string | undefined>) {
  const values = items.filter((item): item is string => Boolean(item))

  return values.length > 0 ? values.join(' · ') : 'default'
}

function formatInputAudit(audit: SkillRunAudit) {
  return joinAuditItems([
    audit.input.missingRequired.length > 0
      ? `missing:${audit.input.missingRequired.join(',')}`
      : undefined,
    audit.input.available.length > 0
      ? `available:${audit.input.available.join(',')}`
      : undefined,
    audit.input.required.length > 0
      ? `required:${audit.input.required.join(',')}`
      : undefined,
    audit.input.optional.length > 0
      ? `optional:${audit.input.optional.join(',')}`
      : undefined,
  ])
}

function formatRetrievalAudit(audit: SkillRunAudit) {
  return joinAuditItems([
    audit.retrieval.includeRecentChapters !== undefined
      ? `recent:${audit.retrieval.includeRecentChapters}`
      : undefined,
    audit.retrieval.includeCharacters
      ? `characters:${audit.retrieval.includeCharacters}`
      : undefined,
    audit.retrieval.includeWorldbuilding
      ? `world:${audit.retrieval.includeWorldbuilding}`
      : undefined,
    audit.retrieval.sourceFamilies?.length
      ? `sources:${audit.retrieval.sourceFamilies.join(',')}`
      : undefined,
  ])
}

function formatModelAudit(audit: SkillRunAudit) {
  return joinAuditItems([
    audit.model.profile ? `profile:${audit.model.profile}` : undefined,
    audit.model.temperature !== undefined
      ? `temperature:${audit.model.temperature}`
      : undefined,
  ])
}

function formatMemoryFilterReason(reason: string) {
  const labels: Record<string, string> = {
    recent_chapters_disabled: 'recent disabled',
    recall_disabled: 'recall disabled',
    characters_disabled: 'characters disabled',
    worldbuilding_disabled: 'world disabled',
    source_family_disabled: 'source family disabled',
  }

  return labels[reason] || reason
}

function formatInputContract(skill: SkillManifest, type: 'required' | 'optional') {
  const values = skill.input?.[type] || []

  return values.length > 0 ? values.join(', ') : 'none'
}

function formatRetrievalContract(skill: SkillManifest) {
  return joinAuditItems([
    skill.retrieval?.includeRecentChapters !== undefined
      ? `recent:${skill.retrieval.includeRecentChapters}`
      : undefined,
    skill.retrieval?.includeCharacters
      ? `characters:${skill.retrieval.includeCharacters}`
      : undefined,
    skill.retrieval?.includeWorldbuilding
      ? `world:${skill.retrieval.includeWorldbuilding}`
      : undefined,
    skill.retrieval?.sourceFamilies?.length
      ? `sources:${skill.retrieval.sourceFamilies.join(',')}`
      : undefined,
  ])
}

function formatModelContract(skill: SkillManifest) {
  return joinAuditItems([
    skill.model?.profile ? `profile:${skill.model.profile}` : undefined,
    skill.model?.temperature !== undefined
      ? `temperature:${skill.model.temperature}`
      : undefined,
  ])
}

const skillSourceFilters: {
  value: SkillCatalogSourceFilter
  label: string
}[] = [
  { value: 'all', label: '全部' },
  { value: 'builtin', label: '内置' },
  { value: 'bundled_yaml', label: '示例' },
  { value: 'project_yaml', label: '项目' },
]

function getSkillEmptyState(sourceFilter: SkillCatalogSourceFilter) {
  if (sourceFilter === 'project_yaml') {
    return {
      title: '暂无项目 Skill',
      description: '项目本地 Skill 会从当前项目的 skills/ 目录加载。',
      command:
        'npm run skills:new -- --project <novel-project> --id demo.local_review --name "本书体检" --mode report --risk low --category memory',
    }
  }

  if (sourceFilter === 'bundled_yaml') {
    return {
      title: '暂无示例 Skill',
      description: '示例 Skill 来自仓库 examples/skills，可作为社区贡献模板。',
    }
  }

  if (sourceFilter === 'builtin') {
    return {
      title: '暂无内置 Skill',
      description: '内置 Skill 由编辑器注册表提供，适合承载必须随产品发布的动作。',
    }
  }

  return {
    title: '暂无 Skill',
    description: 'Skill 包会合并内置、示例和项目本地 YAML 清单。',
  }
}

function SkillCatalogEntryItem({
  entry,
  runningSkillId,
  onPreviewSkill,
  onRunSkill,
}: {
  entry: SkillCatalogEntry
  runningSkillId: string | null
  onPreviewSkill: (skill: SkillManifest) => void
  onRunSkill: (skill: SkillManifest) => void | Promise<void>
}) {
  return (
    <AccordionItem
      className="skill-catalog-item"
      key={entry.manifest.id}
      value={entry.manifest.id}
    >
      <AccordionTrigger className="skill-catalog-trigger">
        <span className="skill-catalog-heading">
          <span>{entry.manifest.name}</span>
          <small>{entry.manifest.id}</small>
        </span>
        <span className="skill-catalog-badges">
          <Badge variant="secondary">{entry.manifest.outputMode}</Badge>
          <Badge className={`skill-source ${entry.source}`} variant="outline">
            {formatSkillCatalogSource(entry.source)}
          </Badge>
        </span>
      </AccordionTrigger>
      <AccordionContent className="skill-catalog-content">
        <p>{entry.manifest.description}</p>
        <dl className="skill-contract-grid">
          <div>
            <dt>version</dt>
            <dd>{entry.manifest.version}</dd>
          </div>
          <div>
            <dt>category</dt>
            <dd>{entry.manifest.category}</dd>
          </div>
          <div>
            <dt>risk</dt>
            <dd>{entry.manifest.riskLevel}</dd>
          </div>
          <div>
            <dt>review</dt>
            <dd>{entry.manifest.requiresReview ? 'required' : 'optional'}</dd>
          </div>
          <div>
            <dt>required</dt>
            <dd>{formatInputContract(entry.manifest, 'required')}</dd>
          </div>
          <div>
            <dt>optional</dt>
            <dd>{formatInputContract(entry.manifest, 'optional')}</dd>
          </div>
          <div>
            <dt>retrieval</dt>
            <dd>{formatRetrievalContract(entry.manifest)}</dd>
          </div>
          <div>
            <dt>model</dt>
            <dd>{formatModelContract(entry.manifest)}</dd>
          </div>
        </dl>
        <small className="skill-path">{describeSkillCatalogSource(entry)}</small>
        <div className="skill-actions">
          <Button
            disabled={runningSkillId === entry.manifest.id}
            onClick={() => onPreviewSkill(entry.manifest)}
            size="sm"
            type="button"
            variant="outline"
          >
            预览上下文
          </Button>
          <Button
            disabled={runningSkillId === entry.manifest.id}
            onClick={() => void onRunSkill(entry.manifest)}
            size="sm"
            type="button"
            variant="secondary"
          >
            {runningSkillId === entry.manifest.id ? '运行中' : '运行 Skill'}
          </Button>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

export function SkillsPanel({
  skillCatalog,
  agentToolExecution,
  agentToolRunning,
  onRunAgentTool,
  runningSkillId,
  lastSkillAudit,
  runtimeError,
  lastResult,
  rewritePatch,
  diffParts,
  patchValidation,
  acceptedStateProposalKeys,
  acceptedPlotThreadProposalKeys,
  onRunSkill,
  onPreviewSkill,
  onConfirmStateProposal,
  onConfirmPlotThreadProposal,
  onAcceptPatch,
  onRejectPatch,
}: SkillsPanelProps) {
  const [activeSourceFilter, setActiveSourceFilter] =
    useState<SkillCatalogSourceFilter>('all')
  const sourceSummary = useMemo(
    () => summarizeSkillCatalogSources(skillCatalog.skills),
    [skillCatalog.skills],
  )
  const visibleSkillEntries = useMemo(
    () =>
      filterSkillCatalogEntriesBySource(
        skillCatalog.skills,
        activeSourceFilter,
      ),
    [activeSourceFilter, skillCatalog.skills],
  )
  const activeSourceLabel =
    activeSourceFilter === 'all'
      ? '全部'
      : formatSkillCatalogSource(activeSourceFilter)
  const emptyState = getSkillEmptyState(activeSourceFilter)

  return (
    <>
      <InspectorSection title="Agent 工具">
        <Card className="agent-tool-card" size="sm">
          <CardHeader>
            <CardTitle>Novel Agent Bridge</CardTitle>
            <CardDescription>
              {agentToolCount} tools ·{' '}
              {countAgentToolsByRisk('read')} read ·{' '}
              {countAgentToolsByRisk('reviewed_write')} review ·{' '}
              {countAgentToolsByRisk('dry_run')} dry-run
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="agent-tool-action-stack">
              <div className="agent-tool-action-group">
                <span className="agent-tool-action-label">read</span>
                <div className="agent-tool-actions">
                  {agentReadActions.map((action) => (
                    <Button
                      disabled={Boolean(agentToolRunning)}
                      key={action.name}
                      onClick={() => void onRunAgentTool(action.name)}
                      size="sm"
                      type="button"
                      variant={
                        agentToolRunning === action.name ? 'secondary' : 'outline'
                      }
                    >
                      {agentToolRunning === action.name ? '运行中' : action.label}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="agent-tool-action-group">
                <span className="agent-tool-action-label">review</span>
                <div className="agent-tool-actions review">
                  {agentReviewActions.map((action) => (
                    <Button
                      disabled={Boolean(agentToolRunning)}
                      key={action.name}
                      onClick={() => void onRunAgentTool(action.name)}
                      size="sm"
                      type="button"
                      variant={
                        agentToolRunning === action.name ? 'secondary' : 'outline'
                      }
                    >
                      {agentToolRunning === action.name ? '运行中' : action.label}
                    </Button>
                  ))}
                </div>
              </div>
            </div>
            <dl className="agent-tool-grid">
              <div>
                <dt>last</dt>
                <dd>{agentToolExecution?.name || 'none'}</dd>
              </div>
              <div>
                <dt>policy</dt>
                <dd>
                  {agentToolExecution
                    ? agentRiskLabel[agentToolExecution.policy.risk]
                    : 'none'}
                </dd>
              </div>
              <div>
                <dt>input</dt>
                <dd>{formatAgentToolInput(agentToolExecution)}</dd>
              </div>
              <div>
                <dt>result</dt>
                <dd>{formatAgentToolResultSummary(agentToolExecution)}</dd>
              </div>
            </dl>
          </CardContent>
        </Card>
      </InspectorSection>

      <InspectorSection title="Skill 包">
        <div className="skill-source-toolbar">
          <ToggleGroup
            aria-label="Skill source filter"
            className="skill-source-filter"
            onValueChange={(value) => {
              if (value) setActiveSourceFilter(value as SkillCatalogSourceFilter)
            }}
            size="sm"
            type="single"
            value={activeSourceFilter}
            variant="outline"
          >
            {skillSourceFilters.map((filter) => (
              <ToggleGroupItem
                aria-label={`${filter.label} Skill`}
                key={filter.value}
                value={filter.value}
              >
                <span>{filter.label}</span>
                <strong>{sourceSummary[filter.value]}</strong>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <small>
            {visibleSkillEntries.length}/{sourceSummary.all} · {activeSourceLabel}
          </small>
        </div>
        {visibleSkillEntries.length > 0 ? (
          <Accordion className="skill-panel" collapsible type="single">
            {visibleSkillEntries.map((entry) => (
              <SkillCatalogEntryItem
                entry={entry}
                key={entry.manifest.id}
                onPreviewSkill={onPreviewSkill}
                onRunSkill={onRunSkill}
                runningSkillId={runningSkillId}
              />
            ))}
          </Accordion>
        ) : (
          <Empty className="inspector-empty skill-empty">
            <EmptyHeader>
              <EmptyTitle>{emptyState.title}</EmptyTitle>
              <EmptyDescription>
                {emptyState.description}
              </EmptyDescription>
            </EmptyHeader>
            {emptyState.command ? (
              <EmptyContent>
                <code className="skill-empty-command">{emptyState.command}</code>
              </EmptyContent>
            ) : null}
          </Empty>
        )}
      </InspectorSection>

      {lastSkillAudit ? (
        <InspectorSection title="上下文审计">
          <Card className="skill-audit-card" size="sm">
            <CardHeader>
              <CardTitle>{lastSkillAudit.skill.name}</CardTitle>
              <CardDescription>
                {lastSkillAudit.skill.id}@{lastSkillAudit.skill.version} ·{' '}
                {lastSkillAudit.provider.label} · {lastSkillAudit.skill.outputMode}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="skill-audit-prompt">{lastSkillAudit.prompt}</p>
              <dl className="skill-audit-grid">
                <div>
                  <dt>input</dt>
                  <dd>{formatInputAudit(lastSkillAudit)}</dd>
                </div>
                <div>
                  <dt>retrieval</dt>
                  <dd>{formatRetrievalAudit(lastSkillAudit)}</dd>
                </div>
                <div>
                  <dt>model</dt>
                  <dd>{formatModelAudit(lastSkillAudit)}</dd>
                </div>
                <div>
                  <dt>context</dt>
                  <dd>
                    selected:{lastSkillAudit.context.selectedChars} · nearby:
                    {lastSkillAudit.context.nearbyChars} · memories:
                    {lastSkillAudit.context.memoryCount}
                  </dd>
                </div>
                <div>
                  <dt>memory filter</dt>
                  <dd>
                    {lastSkillAudit.memoryFilter.beforeCount}→
                    {lastSkillAudit.memoryFilter.afterCount} · dropped:
                    {lastSkillAudit.memoryFilter.droppedCount}
                  </dd>
                </div>
              </dl>
              {lastSkillAudit.memoryLayerSummaries.length > 0 ? (
                <div
                  className="skill-memory-layer-grid"
                  aria-label="Skill memory layer summary"
                >
                  {lastSkillAudit.memoryLayerSummaries.map((summary) => (
                    <span key={summary.layer}>
                      <strong>{summary.layer}</strong>
                      <small>
                        {summary.count} items · {summary.chars} chars
                      </small>
                    </span>
                  ))}
                </div>
              ) : null}
              {lastSkillAudit.memoryFilter.dropped.length > 0 ? (
                <div
                  className="skill-memory-filter-list"
                  aria-label="Skill filtered memories"
                >
                  {lastSkillAudit.memoryFilter.dropped.map((drop) => (
                    <span key={`${drop.reason}-${drop.layer}-${drop.source}`}>
                      <strong>{formatMemoryFilterReason(drop.reason)}</strong>
                      <small>
                        {drop.layer} · {drop.source}
                      </small>
                    </span>
                  ))}
                </div>
              ) : null}
            </CardContent>
            {lastSkillAudit.memorySources.length > 0 ? (
              <CardFooter>
                <small>{lastSkillAudit.memorySources.join(' · ')}</small>
              </CardFooter>
            ) : null}
          </Card>
        </InspectorSection>
      ) : null}

      {runtimeError ? (
        <InspectorSection title="运行错误">
          <Alert variant="destructive">
            <AlertTitle>Skill 运行失败</AlertTitle>
            <AlertDescription>{runtimeError}</AlertDescription>
          </Alert>
        </InspectorSection>
      ) : null}

      {skillCatalog.errors.length > 0 ? (
        <InspectorSection title="Skill 目录">
          <Alert variant="destructive">
            <AlertTitle>目录中有无效 Skill</AlertTitle>
            <AlertDescription>
              {skillCatalog.errors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </AlertDescription>
          </Alert>
        </InspectorSection>
      ) : null}

      {lastResult && lastResult.type !== 'rewrite_patch' ? (
        <InspectorSection title={lastResult.type}>
          <Card className="skill-result-card" size="sm">
            <CardHeader>
              <CardTitle>{lastResult.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{lastResult.body}</p>
              {lastResult.type === 'memory_update_proposal' ? (
                <div className="state-proposals">
                  {lastResult.proposals.map((proposal) => {
                    if (isPlotThreadProposal(proposal)) {
                      const proposalKey = plotThreadProposalKey(proposal)
                      const isAccepted =
                        acceptedPlotThreadProposalKeys.has(proposalKey)

                      return (
                        <Card className="state-proposal" key={proposalKey} size="sm">
                          <CardHeader>
                            <CardTitle>{proposal.title}</CardTitle>
                            <CardDescription>
                              {proposal.confidence
                                ? `confidence:${proposal.confidence}`
                                : 'plot_thread'}
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <p>{proposal.content}</p>
                            <small>{proposal.keywords.join(' · ')}</small>
                          </CardContent>
                          <CardFooter>
                            <Button
                              disabled={isAccepted}
                              onClick={() => onConfirmPlotThreadProposal(proposal)}
                              size="sm"
                              type="button"
                            >
                              {isAccepted ? '已确认' : '确认写入伏笔'}
                            </Button>
                          </CardFooter>
                        </Card>
                      )
                    }

                    if (!isCharacterStateProposal(proposal)) {
                      return null
                    }

                    const proposalKey = stateProposalKey(proposal)
                    const isAccepted = acceptedStateProposalKeys.has(proposalKey)

                    return (
                      <Card className="state-proposal" key={proposalKey} size="sm">
                        <CardHeader>
                          <CardTitle>
                            {proposal.characterName} · {proposal.field}
                          </CardTitle>
                          <CardDescription>{proposal.reason}</CardDescription>
                        </CardHeader>
                        <CardContent>
                          <p>
                            {proposal.from ? `${proposal.from} -> ` : ''}
                            {proposal.to}
                          </p>
                        </CardContent>
                        <CardFooter>
                          <Button
                            disabled={isAccepted}
                            onClick={() => onConfirmStateProposal(proposal)}
                            size="sm"
                            type="button"
                          >
                            {isAccepted ? '已确认' : '确认写入状态'}
                          </Button>
                        </CardFooter>
                      </Card>
                    )
                  })}
                </div>
              ) : null}
            </CardContent>
          </Card>
        </InspectorSection>
      ) : null}

      {rewritePatch ? (
        <InspectorSection title="AI Diff">
          <div className="diff-panel" aria-label="AI rewrite preview">
            <Alert
              className={patchValidation?.ok ? 'safe-state ok' : 'safe-state'}
              variant={patchValidation?.ok ? 'default' : 'destructive'}
            >
              <AlertTitle>
                {patchValidation?.ok ? '可安全应用' : '需要重新生成'}
              </AlertTitle>
              <AlertDescription>{patchValidation?.reason}</AlertDescription>
            </Alert>
            {lastResult?.type === 'rewrite_patch' ? (
              <ul className="audit-trail">
                {lastResult.auditTrail.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            ) : null}
            <div className="diff-body">
              {diffParts.map((part, index) => (
                <span className={`diff-${part.op}`} key={`${part.op}-${index}`}>
                  {part.text}
                </span>
              ))}
            </div>
            <div className="diff-actions">
              <Button
                disabled={!patchValidation?.ok}
                onClick={() => void onAcceptPatch()}
                size="sm"
                type="button"
              >
                接受
              </Button>
              <Button
                onClick={onRejectPatch}
                size="sm"
                type="button"
                variant="secondary"
              >
                拒绝
              </Button>
            </div>
          </div>
        </InspectorSection>
      ) : null}
    </>
  )
}
