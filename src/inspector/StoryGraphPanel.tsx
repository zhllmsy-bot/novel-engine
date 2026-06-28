import { useEffect, useMemo, useRef, useState } from 'react'

import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@/components/ui/toggle-group'
import { InspectorSection } from './components'
import {
  buildStoryGraph,
  filterStoryGraphByView,
  getStoryGraphNodeContext,
  summarizeStoryGraph,
  type StoryGraphConnection,
  type StoryGraphNode,
  type StoryGraphView,
} from './storyGraph'
import {
  buildStoryGraphSnapshot,
  getStoryGraphSnapshotContentKey,
  storyGraphSnapshotPath,
} from './storyGraphSnapshot'
import type { StoryGraphPanelProps } from './types'

const nodeClassByKind: Record<StoryGraphNode['kind'], string> = {
  chapter: 'story-node-chapter',
  memory: 'story-node-memory',
  codex: 'story-node-codex',
  plot_thread: 'story-node-plot',
  skill_run: 'story-node-skill',
  publish_job: 'story-node-publish',
}

const kindLabel: Record<StoryGraphNode['kind'], string> = {
  chapter: '章节',
  memory: '记忆',
  codex: '设定',
  plot_thread: '伏笔',
  skill_run: '技能',
  publish_job: '发布',
}

const graphViews: { value: StoryGraphView; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'memory', label: '记忆' },
  { value: 'codex', label: '设定' },
  { value: 'plot_thread', label: '伏笔' },
  { value: 'skill_run', label: '技能' },
  { value: 'publish_job', label: '发布' },
]

export function StoryGraphPanel({
  activeChapter,
  projectTitle,
  initialGraphSnapshot,
  onGraphSnapshotChange,
  runtimeMemoryPlan,
  codexEntries,
  plotThreads,
  lastSkillAudit,
  lastResult,
  publishPlan,
  publisherReport,
}: StoryGraphPanelProps) {
  const graph = useMemo(
    () =>
      buildStoryGraph({
        activeChapter,
        runtimeMemoryPlan,
        codexEntries,
        plotThreads,
        lastSkillAudit,
        lastResult,
        publishPlan,
        publisherReport,
      }),
    [
      activeChapter,
      runtimeMemoryPlan,
      codexEntries,
      plotThreads,
      lastSkillAudit,
      lastResult,
      publishPlan,
      publisherReport,
    ],
  )
  const [activeView, setActiveView] = useState<StoryGraphView>('all')
  const visibleGraph = useMemo(
    () => filterStoryGraphByView(graph, activeView),
    [activeView, graph],
  )
  const graphSummary = useMemo(
    () => summarizeStoryGraph(graph, visibleGraph),
    [graph, visibleGraph],
  )
  const nodeById = useMemo(
    () => new Map(visibleGraph.nodes.map((node) => [node.id, node])),
    [visibleGraph.nodes],
  )
  const defaultNodeId = visibleGraph.nodes[0]?.id || ''
  const [selectedNodeId, setSelectedNodeId] = useState(defaultNodeId)
  const lastSnapshotKeyRef = useRef('')
  const restoredSnapshotKeyRef = useRef<string | null>(null)
  const initialSnapshotKey = initialGraphSnapshot
    ? getStoryGraphSnapshotContentKey(initialGraphSnapshot)
    : ''
  const restorableSnapshotSelectedNodeId = useMemo(() => {
    if (!initialGraphSnapshot || !activeChapter) return ''
    if (
      initialGraphSnapshot.source.activeChapterId &&
      initialGraphSnapshot.source.activeChapterId !== activeChapter.id
    ) {
      return ''
    }

    const snapshotSelectedId = initialGraphSnapshot.viewState.selectedNodeId
    return snapshotSelectedId && nodeById.has(snapshotSelectedId)
      ? snapshotSelectedId
      : ''
  }, [activeChapter, initialGraphSnapshot, nodeById])

  useEffect(() => {
    if (!defaultNodeId) return
    if (nodeById.has(selectedNodeId)) return

    setSelectedNodeId(defaultNodeId)
  }, [defaultNodeId, nodeById, selectedNodeId])

  useEffect(() => {
    if (!initialSnapshotKey || !restorableSnapshotSelectedNodeId) return
    if (restoredSnapshotKeyRef.current === initialSnapshotKey) return

    if (selectedNodeId !== restorableSnapshotSelectedNodeId) {
      setSelectedNodeId(restorableSnapshotSelectedNodeId)
      return
    }

    restoredSnapshotKeyRef.current = initialSnapshotKey
  }, [
    initialSnapshotKey,
    restorableSnapshotSelectedNodeId,
    selectedNodeId,
  ])

  const graphSnapshot = useMemo(
    () =>
      buildStoryGraphSnapshot({
        graph,
        projectTitle,
        activeChapterId: activeChapter?.id,
        activeChapterTitle: activeChapter?.title,
        selectedNodeId,
      }),
    [
      activeChapter?.id,
      activeChapter?.title,
      graph,
      projectTitle,
      selectedNodeId,
    ],
  )

  useEffect(() => {
    if (!onGraphSnapshotChange) return
    if (
      restorableSnapshotSelectedNodeId &&
      restoredSnapshotKeyRef.current !== initialSnapshotKey
    ) {
      return
    }

    const snapshotKey = getStoryGraphSnapshotContentKey(graphSnapshot)
    if (lastSnapshotKeyRef.current === snapshotKey) return

    lastSnapshotKeyRef.current = snapshotKey
    void onGraphSnapshotChange(graphSnapshot)
  }, [
    graphSnapshot,
    initialSnapshotKey,
    onGraphSnapshotChange,
    restorableSnapshotSelectedNodeId,
  ])

  const selectedContext =
    getStoryGraphNodeContext(visibleGraph, selectedNodeId) ||
    getStoryGraphNodeContext(visibleGraph, defaultNodeId)

  const connectedEdgeIds = new Set([
    ...(selectedContext?.incoming.map(({ edge }) => edge.id) || []),
    ...(selectedContext?.outgoing.map(({ edge }) => edge.id) || []),
  ])
  const connectedNodeIds = new Set([
    selectedContext?.node.id,
    ...(selectedContext?.incoming.map(({ node }) => node.id) || []),
    ...(selectedContext?.outgoing.map(({ node }) => node.id) || []),
  ])

  return (
    <>
      <InspectorSection title="故事图谱">
        <div className="story-graph-contract" aria-label="Story graph snapshot">
          <span>{storyGraphSnapshotPath}</span>
          <span>v{graphSnapshot.version}</span>
          <span>
            {graphSummary.visibleNodes}/{graphSummary.totalNodes} 节点 ·{' '}
            {graphSummary.visibleEdges}/{graphSummary.totalEdges} 边
          </span>
        </div>
        <ToggleGroup
          aria-label="Story graph view"
          className="story-graph-filter"
          onValueChange={(value) => {
            if (value) setActiveView(value as StoryGraphView)
          }}
          size="sm"
          type="single"
          value={activeView}
          variant="outline"
        >
          {graphViews.map((view) => (
            <ToggleGroupItem
              aria-label={`${view.label}图谱`}
              key={view.value}
              value={view.value}
            >
              {view.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <GraphLegend summary={graphSummary} />
        <div className="story-graph-frame" aria-label="Story graph">
          <svg
            aria-label="Story memory provenance graph"
            className="story-graph-svg"
            role="img"
            viewBox="0 0 620 420"
          >
            {visibleGraph.edges.map((edge) => {
              const from = nodeById.get(edge.from)
              const to = nodeById.get(edge.to)
              if (!from || !to) return null

              return (
                <g key={edge.id}>
                  <path
                    className={`story-edge ${
                      connectedEdgeIds.has(edge.id) ? 'is-selected' : ''
                    }`}
                    d={`M ${from.x + 128} ${from.y + 20} C ${from.x + 190} ${from.y + 20}, ${to.x - 64} ${to.y + 20}, ${to.x} ${to.y + 20}`}
                  />
                  <text
                    className={`story-edge-label ${
                      connectedEdgeIds.has(edge.id) ? 'is-selected' : ''
                    }`}
                    x={(from.x + to.x) / 2 + 44}
                    y={(from.y + to.y) / 2 + 11}
                  >
                    {edge.label}
                  </text>
                </g>
              )
            })}
            {visibleGraph.nodes.map((node) => (
              <g
                className={`story-node ${nodeClassByKind[node.kind]}`}
                key={node.id}
                onClick={() => setSelectedNodeId(node.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    setSelectedNodeId(node.id)
                  }
                }}
                focusable="true"
                role="button"
                tabIndex={0}
                transform={`translate(${node.x} ${node.y})`}
              >
                <rect
                  className={
                    node.id === selectedContext?.node.id
                      ? 'is-selected'
                      : connectedNodeIds.has(node.id)
                        ? 'is-related'
                        : ''
                  }
                  height="40"
                  rx="4"
                  width="132"
                />
                <text className="story-node-kind" x="10" y="14">
                  {kindLabel[node.kind]}
                </text>
                <text className="story-node-label" x="10" y="29">
                  {node.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </InspectorSection>

      {selectedContext ? (
        <InspectorSection title="上下文来源">
          <Card
            className={`story-node-card story-node-context ${
              nodeClassByKind[selectedContext.node.kind]
            }`}
            size="sm"
          >
            <CardHeader>
              <div className="memory-heading">
                <CardTitle>{selectedContext.node.label}</CardTitle>
                <Badge variant="outline">
                  {kindLabel[selectedContext.node.kind]}
                </Badge>
              </div>
              <CardDescription>
                {selectedContext.node.layer || selectedContext.node.kind}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p>{selectedContext.node.detail}</p>
              <ConnectionList
                connections={selectedContext.incoming}
                emptyLabel="没有上游来源"
                title="上游"
              />
              <ConnectionList
                connections={selectedContext.outgoing}
                emptyLabel="没有下游去向"
                title="下游"
              />
            </CardContent>
          </Card>
        </InspectorSection>
      ) : null}

      <InspectorSection title="节点">
        <div className="story-node-list" aria-label="Story graph nodes">
          {visibleGraph.nodes.map((node) => (
            <button
              aria-pressed={node.id === selectedContext?.node.id}
              className={`story-node-card ${nodeClassByKind[node.kind]}`}
              key={node.id}
              onClick={() => setSelectedNodeId(node.id)}
              type="button"
            >
              <div className="story-node-card-header">
                <div className="memory-heading">
                  <span className="story-node-card-title">{node.label}</span>
                  <Badge variant="outline">{kindLabel[node.kind]}</Badge>
                </div>
                <span className="story-node-card-description">
                  {node.layer || node.kind}
                </span>
              </div>
              <div className="story-node-card-content">
                <p>{node.detail}</p>
              </div>
            </button>
          ))}
        </div>
      </InspectorSection>
    </>
  )
}

function GraphLegend({
  summary,
}: {
  summary: ReturnType<typeof summarizeStoryGraph>
}) {
  const memoryLayerItems = [
    { layer: 'L2 风格', className: 'layer-prose' },
    { layer: 'L0 事实', className: 'layer-facts' },
    { layer: 'L3 意图', className: 'layer-recall' },
    { layer: 'L1 剧情', className: 'layer-plot' },
  ] as const

  return (
    <div className="story-graph-legend" aria-label="Story graph legend">
      <div className="story-legend-grid">
        <LegendPill
          className="story-node-memory"
          label="记忆"
          value={summary.nodesByKind.memory}
        />
        <LegendPill
          className="story-node-codex"
          label="设定"
          value={summary.nodesByKind.codex}
        />
        <LegendPill
          className="story-node-plot"
          label="伏笔"
          value={summary.nodesByKind.plot_thread}
        />
        <LegendPill
          className="story-node-skill"
          label="技能"
          value={summary.nodesByKind.skill_run}
        />
        <LegendPill
          className="story-node-publish"
          label="发布"
          value={summary.nodesByKind.publish_job}
        />
      </div>
      <div className="story-memory-layer-grid">
        {memoryLayerItems.map((item) => (
          <span className={item.className} key={item.layer}>
            {item.layer} · {summary.memoryLayers[item.layer] || 0}
          </span>
        ))}
      </div>
    </div>
  )
}

function LegendPill({
  className,
  label,
  value,
}: {
  className: string
  label: string
  value: number
}) {
  return (
    <span className={`story-legend-pill ${className}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </span>
  )
}

function ConnectionList({
  title,
  emptyLabel,
  connections,
}: {
  title: string
  emptyLabel: string
  connections: StoryGraphConnection[]
}) {
  return (
    <div className="story-context-list">
      <div className="story-context-title">{title}</div>
      {connections.length ? (
        connections.map(({ edge, node }) => (
          <div className="story-context-row" key={edge.id}>
            <Badge variant="secondary">{edge.label}</Badge>
            <span>{node.label}</span>
          </div>
        ))
      ) : (
        <p className="story-context-empty">{emptyLabel}</p>
      )}
    </div>
  )
}
