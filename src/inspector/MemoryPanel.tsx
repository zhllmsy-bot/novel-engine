import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
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
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import { Progress } from '@/components/ui/progress'
import {
  memoryBudgetLayerOrder,
  memoryBudgetPolicy,
  type MemoryBudgetAuditEntry,
} from '@/memory/memoryContextBuilder'
import { buildMemorySourceSummary } from '@/memory/memorySourceSummary'
import type { NarrativeMemory } from '@/types/domain'
import { InspectorSection } from './components'
import { parseMemorySourceChips } from './memorySourceChips'
import type { MemoryPanelProps } from './types'
import { volumeSummaryPromptAudit } from './volumeSummaryAudit'

const layerMeta: Record<
  NarrativeMemory['layer'],
  {
    role: string
    description: string
    className: string
  }
> = {
  'L0 事实': {
    role: '设定与状态',
    description: '人物、物品、地点和已确认动态状态。',
    className: 'layer-facts',
  },
  'L1 剧情': {
    role: '长程脉络',
    description: '章节摘要与全书发展，超预算时优先压缩。',
    className: 'layer-plot',
  },
  'L2 风格': {
    role: '近期原文',
    description: '当前草稿和近章正文，优先保留文风连续性。',
    className: 'layer-prose',
  },
  'L3 意图': {
    role: '动态召回',
    description: '本章关键词、召回审计和当前写作目标。',
    className: 'layer-recall',
  },
}

const budgetStatusLabel: Record<MemoryBudgetAuditEntry['status'], string> = {
  included: 'included',
  truncated: 'truncated',
  dropped: 'dropped',
}

const layerSummaryLabel = {
  used: 'used',
  target: 'target',
  entries: 'entries',
} as const

function budgetStatusVariant(status: MemoryBudgetAuditEntry['status']) {
  return status === 'dropped'
    ? 'destructive'
    : status === 'truncated'
      ? 'outline'
      : 'secondary'
}

function SourceBadges({ source }: { source: string }) {
  const chips = parseMemorySourceChips(source)

  return (
    <div className="source-chip-list" aria-label="Memory sources">
      {chips.map((chip, index) => (
        <Badge
          className={`source-chip source-${chip.kind.replace(/[^a-z0-9_-]/gi, '-')}`}
          key={`${chip.kind}-${chip.detail}-${index}`}
          title={`${chip.label}: ${chip.detail}`}
          variant={chip.kind === 'volume_summary' ? 'secondary' : 'outline'}
        >
          <span>{chip.label}</span>
          <small>{chip.detail}</small>
        </Badge>
      ))}
    </div>
  )
}

function MemoryLayerContract() {
  return (
    <div className="memory-contract-grid" aria-label="Four-layer memory contract">
      {memoryBudgetLayerOrder.map((layer) => {
        const policy = memoryBudgetPolicy.layers[layer]
        const targetLabel = `${Math.round(policy.targetBudgetShare[0] * 100)}-${Math.round(policy.targetBudgetShare[1] * 100)}%`

        return (
          <Card
            className={`memory-contract-card ${layerMeta[layer].className}`}
            key={layer}
            size="sm"
          >
            <CardHeader>
              <div className="memory-heading">
                <Badge variant="outline">{layer}</Badge>
                <CardDescription>{targetLabel}</CardDescription>
              </div>
              <CardTitle>{layerMeta[layer].role}</CardTitle>
            </CardHeader>
            <CardContent>
              <p>{layerMeta[layer].description}</p>
              <small>{policy.degradation}</small>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

function MemorySourceSummary({
  memories,
  budgetChars,
}: {
  memories: NarrativeMemory[]
  budgetChars: number
}) {
  const sourceSummary = buildMemorySourceSummary(memories)

  if (sourceSummary.length === 0) {
    return (
      <Empty className="inspector-empty">
        <EmptyHeader>
          <EmptyTitle>暂无记忆来源</EmptyTitle>
          <EmptyDescription>当前章节还没有可注入的上下文证据。</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  }

  return (
    <div className="memory-source-summary" aria-label="Memory source summary">
      {sourceSummary.map((summary) => {
        const selectedPercent = Math.round(
          (summary.selectedChars / Math.max(budgetChars, 1)) * 100,
        )

        return (
          <Card
            className={`memory-source-card source-family-${summary.family}`}
            key={summary.family}
            size="sm"
          >
            <CardHeader>
              <div className="memory-source-card-heading">
                <CardTitle>{summary.label}</CardTitle>
                <Badge variant="outline">{summary.memoryCount}</Badge>
              </div>
              <CardDescription>
                {summary.sourceCount} sources · {summary.selectedChars} chars
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Progress value={selectedPercent} />
              <small title={summary.sources.join(' · ')}>
                {summary.sources.join(' · ')}
              </small>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

export function MemoryPanel({
  runtimeMemories,
  runtimeMemoryPlan,
  activeChapterSummary,
  volumeSummaries,
  chapterVersions,
  characterStateLogs,
  plotThreads,
  onRestoreVersion,
}: MemoryPanelProps) {
  const memoryUsagePercent = Math.min(
    100,
    Math.round(
      (runtimeMemoryPlan.audit.usedChars /
        Math.max(runtimeMemoryPlan.audit.budgetChars, 1)) *
        100,
    ),
  )

  return (
    <>
      <InspectorSection title="层级契约">
        <MemoryLayerContract />
      </InspectorSection>

      <InspectorSection title="四层记忆">
        <MemorySourceSummary
          budgetChars={runtimeMemoryPlan.audit.budgetChars}
          memories={runtimeMemories}
        />
        <section className="memory-stack" aria-label="Narrative memory">
          {runtimeMemories.map((memory) => (
            <Card
              className={`memory-row ${layerMeta[memory.layer].className}`}
              key={`${memory.layer}-${memory.source}`}
              size="sm"
            >
              <CardHeader>
                <div className="memory-heading">
                  <Badge variant="outline">{memory.layer}</Badge>
                  <CardDescription>{layerMeta[memory.layer].role}</CardDescription>
                </div>
                <CardTitle>{layerMeta[memory.layer].description}</CardTitle>
              </CardHeader>
              <CardContent>
                <p>{memory.body}</p>
              </CardContent>
              <CardFooter>
                <SourceBadges source={memory.source} />
              </CardFooter>
            </Card>
          ))}
        </section>
      </InspectorSection>

      <InspectorSection title="记忆预算">
        <div className="budget-meter">
          <div>
            <strong>
              {runtimeMemoryPlan.audit.usedChars}/
              {runtimeMemoryPlan.audit.budgetChars}
            </strong>
            <span>{memoryUsagePercent}% used</span>
          </div>
          <Badge
            variant={
              runtimeMemoryPlan.audit.droppedCount > 0 ? 'destructive' : 'secondary'
            }
          >
            {runtimeMemoryPlan.audit.droppedCount} dropped
          </Badge>
          <Progress value={memoryUsagePercent} />
        </div>
        <div className="budget-layer-summaries" aria-label="Memory layer budget">
          {runtimeMemoryPlan.audit.layerSummaries.map((summary) => {
            const selectedPercent = Math.round(
              (summary.selectedChars /
                Math.max(runtimeMemoryPlan.audit.budgetChars, 1)) *
                100,
            )
            const targetLabel = `${Math.round(summary.targetBudgetShare[0] * 100)}-${Math.round(summary.targetBudgetShare[1] * 100)}%`

            return (
              <Card
                className={`budget-layer-summary ${layerMeta[summary.layer].className}`}
                key={summary.layer}
                size="sm"
              >
                <CardHeader>
                  <div className="budget-entry-heading">
                    <CardTitle>{summary.layer}</CardTitle>
                    <Badge
                      variant={
                        summary.droppedCount > 0
                          ? 'destructive'
                          : summary.truncatedCount > 0
                            ? 'outline'
                            : 'secondary'
                      }
                    >
                      {summary.droppedCount > 0
                        ? `${summary.droppedCount} dropped`
                        : summary.truncatedCount > 0
                          ? `${summary.truncatedCount} truncated`
                          : 'clean'}
                    </Badge>
                  </div>
                  <CardDescription>{layerMeta[summary.layer].role}</CardDescription>
                </CardHeader>
                <CardContent>
                  <dl className="budget-layer-metrics">
                    <div>
                      <dt>{layerSummaryLabel.used}</dt>
                      <dd>{selectedPercent}%</dd>
                    </div>
                    <div>
                      <dt>{layerSummaryLabel.target}</dt>
                      <dd>{targetLabel}</dd>
                    </div>
                    <div>
                      <dt>{layerSummaryLabel.entries}</dt>
                      <dd>{summary.entryCount}</dd>
                    </div>
                  </dl>
                  <Progress value={selectedPercent} />
                </CardContent>
              </Card>
            )
          })}
        </div>
        <div className="budget-entries">
          {runtimeMemoryPlan.audit.entries.map((entry) => (
            <Card
              className={`budget-entry ${entry.status}`}
              key={`${entry.source}-${entry.layer}`}
              size="sm"
            >
              <CardHeader>
                <div className="budget-entry-heading">
                  <CardTitle>{entry.layer}</CardTitle>
                  <Badge variant={budgetStatusVariant(entry.status)}>
                    {budgetStatusLabel[entry.status]}
                  </Badge>
                </div>
                <CardDescription>
                  {entry.selectedChars}/{entry.originalChars} chars · priority{' '}
                  {entry.priority}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SourceBadges source={entry.source} />
              </CardContent>
            </Card>
          ))}
        </div>
      </InspectorSection>

      <InspectorSection title="章节摘要">
        {activeChapterSummary ? (
          <Card className="summary-row" size="sm">
            <CardHeader>
              <CardTitle>{activeChapterSummary.chapterTitle}</CardTitle>
              <CardDescription>
                {activeChapterSummary.isEdited ? 'edited' : 'generated'} ·{' '}
                {activeChapterSummary.keyEvents.length} events ·{' '}
                {activeChapterSummary.charactersInvolved.length} characters
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>{activeChapterSummary.summary}</p>
            </CardContent>
          </Card>
        ) : (
          <Empty className="inspector-empty">
            <EmptyHeader>
              <EmptyTitle>尚未生成摘要</EmptyTitle>
              <EmptyDescription>点击顶部“摘要”后会写入本章记忆。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </InspectorSection>

      <InspectorSection title="卷级摘要">
        {volumeSummaries.length > 0 ? (
          <div className="volume-summary-list">
            {volumeSummaries.map((summary) => {
              const promptAudit = volumeSummaryPromptAudit(
                summary.volumeId,
                runtimeMemoryPlan.audit.entries,
              )

              return (
                <Card
                  className={`volume-summary-row prompt-${promptAudit.status}`}
                  key={summary.volumeId}
                  size="sm"
                >
                  <CardHeader>
                    <div className="budget-entry-heading">
                      <CardTitle>{summary.volumeTitle}</CardTitle>
                      <div className="volume-summary-badges">
                        <Badge variant={summary.isEdited ? 'secondary' : 'outline'}>
                          {summary.isEdited ? 'edited' : 'generated'}
                        </Badge>
                        <Badge
                          title={promptAudit.description}
                          variant={
                            promptAudit.status === 'dropped'
                              ? 'destructive'
                              : promptAudit.status === 'included'
                                ? 'secondary'
                                : 'outline'
                          }
                        >
                          {promptAudit.label}
                        </Badge>
                      </div>
                    </div>
                    <CardDescription>
                      {summary.chapterIds.length} chapters ·{' '}
                      {summary.keySignals.length} signals
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p>{summary.summary}</p>
                    <small>{promptAudit.description}</small>
                    {summary.keySignals.length > 0 ? (
                      <div className="source-chip-list" aria-label="Volume signals">
                        {summary.keySignals.slice(0, 4).map((signal, index) => (
                          <Badge
                            className="source-chip"
                            key={`${summary.volumeId}-${signal}-${index}`}
                            title={signal}
                            variant="outline"
                          >
                            <span>信号</span>
                            <small>{signal}</small>
                          </Badge>
                        ))}
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              )
            })}
          </div>
        ) : (
          <Empty className="inspector-empty">
            <EmptyHeader>
              <EmptyTitle>尚未生成卷摘要</EmptyTitle>
              <EmptyDescription>章节摘要形成后会自动压缩为远期 L1 记忆。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </InspectorSection>

      <InspectorSection title="版本时间线">
        {chapterVersions.length > 0 ? (
          <div className="version-list">
            {chapterVersions.map((version) => (
              <Card className="version-row" key={version.id} size="sm">
                <CardHeader>
                  <CardTitle>
                    {version.source === 'ai' ? 'AI 改写前' : '手动快照'}
                  </CardTitle>
                  <CardDescription>
                    {new Intl.DateTimeFormat('zh-CN', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    }).format(new Date(version.createdAt))}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p>{version.note || version.operation}</p>
                </CardContent>
                <CardFooter>
                  <Button
                    onClick={() => void onRestoreVersion(version)}
                    size="sm"
                    type="button"
                    variant="secondary"
                  >
                    恢复
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        ) : (
          <Empty className="inspector-empty">
            <EmptyHeader>
              <EmptyTitle>暂无快照</EmptyTitle>
              <EmptyDescription>手动快照或接受 AI 改写时会记录版本。</EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}
      </InspectorSection>

      {characterStateLogs.length > 0 ? (
        <InspectorSection title="人物状态日志">
          <div className="state-log-panel">
            {characterStateLogs.slice(-3).map((log) => (
              <Card className="state-log-row" key={log.id} size="sm">
                <CardHeader>
                  <CardTitle>
                    {log.characterName} · {log.field}
                  </CardTitle>
                  <CardDescription>{log.chapterTitle}</CardDescription>
                </CardHeader>
                <CardContent>
                  <p>
                    {log.from ? `${log.from} -> ` : ''}
                    {log.to}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </InspectorSection>
      ) : null}

      {plotThreads.length > 0 ? (
        <InspectorSection title="伏笔线程">
          <div className="state-log-panel">
            {plotThreads.slice(-3).map((thread) => (
              <Card className="state-log-row" key={thread.id} size="sm">
                <CardHeader>
                  <CardTitle>{thread.title}</CardTitle>
                  <CardDescription>
                    {thread.status} · {thread.plantedChapterTitle}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p>{thread.content}</p>
                  {thread.resolution ? <small>{thread.resolution}</small> : null}
                </CardContent>
              </Card>
            ))}
          </div>
        </InspectorSection>
      ) : null}
    </>
  )
}
