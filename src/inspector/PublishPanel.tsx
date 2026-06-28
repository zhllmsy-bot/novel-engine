import { UploadCloud } from 'lucide-react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from '@/components/ui/empty'
import {
  auditEditorPublisherAdapter,
  type EditorPublisherAdapterInfo,
  type EditorPublisherReadinessAudit,
} from '@/publisher/editorPublisher'
import { cn } from '@/lib/utils'
import { InspectorSection } from './components'
import type { PublishPanelProps } from './types'

const adapterStatusLabel: Record<EditorPublisherAdapterInfo['status'], string> = {
  available: 'available',
  configured: 'configured',
  planned: 'planned',
}

function adapterStatusVariant(status: EditorPublisherAdapterInfo['status']) {
  return status === 'planned' ? 'outline' : 'secondary'
}

export function PublishPanel({
  publisherAdapters,
  publisherAdapterErrors,
  activePublisherAdapterId,
  publishPlan,
  publisherRunning,
  publisherReport,
  onRunPublisherPreview,
  onPublisherAdapterChange,
}: PublishPanelProps) {
  const nextPublishChapter = publishPlan.pending[0]
  const activeAdapter =
    publisherAdapters.find((adapter) => adapter.id === activePublisherAdapterId) ||
    publisherAdapters.find((adapter) => adapter.runtime.editorDryRun)
  const activeReadiness = activeAdapter
    ? auditEditorPublisherAdapter({
        adapter: activeAdapter,
        publishPlan,
      })
    : null

  return (
    <>
      <InspectorSection title="发布队列">
        <div className="publish-status">
          <div className="publish-grid">
            <div>
              <strong>{publishPlan.pending.length}</strong>
              <span>待发布</span>
            </div>
            <div>
              <strong>{publishPlan.scanned}</strong>
              <span>已扫描</span>
            </div>
            <div>
              <strong>{publishPlan.skipped}</strong>
              <span>已跳过</span>
            </div>
          </div>
          {nextPublishChapter ? (
            <Card className="publish-next" size="sm">
              <CardHeader>
                <CardDescription>下一章</CardDescription>
                <CardTitle>
                  第 {nextPublishChapter.number} 章 · {nextPublishChapter.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p>
                  {nextPublishChapter.wordCount} 字 ·{' '}
                  {activeReadiness?.ready && activeAdapter
                    ? `${activeAdapter.displayName} 预检`
                    : '发布插件待接入'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Empty className="inspector-empty">
              <EmptyHeader>
                <EmptyTitle>没有待发布章节</EmptyTitle>
                <EmptyDescription>发布插件会从未发布章节生成预检任务。</EmptyDescription>
              </EmptyHeader>
            </Empty>
          )}
          <Button
            disabled={publisherRunning || !activeReadiness?.ready}
            onClick={() => void onRunPublisherPreview()}
            type="button"
          >
            <UploadCloud data-icon="inline-start" aria-hidden="true" />
            {publisherRunning ? '预检中' : '运行预检'}
          </Button>
        </div>
      </InspectorSection>

      {publisherReport ? (
        <InspectorSection title="预检报告">
          <Card className="publish-report" size="sm">
            <CardHeader>
              <CardTitle>
                {publisherReport.succeeded}/{publisherReport.attempted} 通过
              </CardTitle>
            </CardHeader>
            <CardContent>
              {publisherReport.results.map(({ chapter, result }) => (
                <p key={`${chapter.id}-${result.remoteId || result.status}`}>
                  第 {chapter.number} 章 · {result.message}
                </p>
              ))}
            </CardContent>
          </Card>
        </InspectorSection>
      ) : null}

      <InspectorSection title="发布插件">
        <Accordion
          className="publisher-adapter-list"
          collapsible
          onValueChange={(value) => {
            if (publisherAdapters.some((adapter) => adapter.id === value)) {
              onPublisherAdapterChange(value)
            }
          }}
          value={activeAdapter?.id}
          type="single"
        >
          {publisherAdapters.map((adapter) => {
            const readiness = auditEditorPublisherAdapter({
              adapter,
              publishPlan,
            })

            return (
              <AccordionItem
                className="publisher-adapter-item"
                key={adapter.id}
                value={adapter.id}
              >
                <AccordionTrigger className="publisher-adapter-trigger">
                  <span className="publisher-adapter-heading">
                    <span>{adapter.displayName}</span>
                    <small>{adapter.id}</small>
                  </span>
                  <span className="publisher-adapter-badges">
                    <Badge
                      className={`publisher-adapter-status ${adapter.status}`}
                      variant={adapterStatusVariant(adapter.status)}
                    >
                      {adapterStatusLabel[adapter.status]}
                    </Badge>
                    <Badge variant={readiness.ready ? 'secondary' : 'outline'}>
                      {readiness.ready ? 'ready' : 'blocked'}
                    </Badge>
                    {adapter.source ? (
                      <Badge variant="outline">{adapter.source}</Badge>
                    ) : null}
                  </span>
                </AccordionTrigger>
                <AccordionContent className="publisher-adapter-content">
                  <p>{adapter.description}</p>
                  <PublisherReadinessAudit readiness={readiness} />
                  <dl className="publisher-contract-grid">
                    <div>
                      <dt>config</dt>
                      <dd>{adapter.configPath || 'none'}</dd>
                    </div>
                    <div>
                      <dt>manifest</dt>
                      <dd>{adapter.path || 'bundled'}</dd>
                    </div>
                    <div>
                      <dt>capabilities</dt>
                      <dd>
                        <ul className="publisher-capabilities">
                          {adapter.capabilities.map((capability) => (
                            <li key={capability}>{capability}</li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  </dl>
                  <Button
                    disabled={!readiness.ready || publisherRunning}
                    onClick={() => void onRunPublisherPreview(adapter.id)}
                    size="sm"
                    type="button"
                    variant={readiness.ready ? 'secondary' : 'outline'}
                  >
                    {readiness.ready
                      ? publisherRunning
                        ? '预检中'
                        : '运行预检'
                      : '待接入'}
                  </Button>
                </AccordionContent>
              </AccordionItem>
            )
          })}
        </Accordion>
        {publisherAdapterErrors.length > 0 ? (
          <div className="publisher-adapter-errors" role="status">
            {publisherAdapterErrors.map((error) => (
              <p key={error}>{error}</p>
            ))}
          </div>
        ) : null}
        <code className="adapter-scaffold-command">
          npm run adapters:new -- --type publisher --project &lt;novel-project&gt; --id
          fanqie-local --name "番茄本地上传"
        </code>
      </InspectorSection>
    </>
  )
}

function PublisherReadinessAudit({
  readiness,
}: {
  readiness: EditorPublisherReadinessAudit
}) {
  return (
    <div className="publisher-readiness-audit" aria-label="Publisher readiness audit">
      <div className="publisher-readiness-heading">
        <span>可用性审计</span>
        <Badge variant={readiness.ready ? 'secondary' : 'outline'}>
          {readiness.ready ? 'ready' : 'blocked'}
        </Badge>
      </div>
      <div className="publisher-readiness-checks">
        {readiness.checks.map((check) => (
          <span
            className={cn(
              check.ready ? 'is-ready' : 'is-missing',
              check.optional && 'is-optional',
            )}
            key={check.id}
          >
            <strong>{check.label}</strong>
            <small>{check.detail}</small>
          </span>
        ))}
      </div>
    </div>
  )
}
