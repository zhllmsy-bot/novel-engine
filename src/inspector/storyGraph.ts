import type { NarrativeMemoryPlan } from '@/memory/memoryContextBuilder'
import type { PlotThread } from '@/memory/plotThreadStore'
import type { CodexEntry, ProjectChapter } from '@/project/projectTypes'
import type {
  EditorPublishPlan,
  EditorPublishReport,
} from '@/publisher/editorPublisher'
import type { SkillRunAudit } from '@/skills/skillRuntime'
import type { NarrativeMemory, SkillRunResult } from '@/types/domain'

export type StoryGraphNodeKind =
  | 'chapter'
  | 'memory'
  | 'codex'
  | 'plot_thread'
  | 'skill_run'
  | 'publish_job'

export type StoryGraphView = 'all' | Exclude<StoryGraphNodeKind, 'chapter'>

export type StoryGraphNode = {
  id: string
  kind: StoryGraphNodeKind
  label: string
  detail: string
  layer?: NarrativeMemory['layer']
  x: number
  y: number
}

export type StoryGraphEdge = {
  id: string
  from: string
  to: string
  label: string
}

export type StoryGraph = {
  nodes: StoryGraphNode[]
  edges: StoryGraphEdge[]
}

export type StoryGraphConnection = {
  edge: StoryGraphEdge
  node: StoryGraphNode
}

export type StoryGraphNodeContext = {
  node: StoryGraphNode
  incoming: StoryGraphConnection[]
  outgoing: StoryGraphConnection[]
}

export type StoryGraphViewSummary = {
  totalNodes: number
  totalEdges: number
  visibleNodes: number
  visibleEdges: number
  nodesByKind: Record<StoryGraphNodeKind, number>
  memoryLayers: Partial<Record<NarrativeMemory['layer'], number>>
}

export type BuildStoryGraphInput = {
  activeChapter?: ProjectChapter
  runtimeMemoryPlan: NarrativeMemoryPlan
  codexEntries: CodexEntry[]
  plotThreads: PlotThread[]
  lastSkillAudit?: SkillRunAudit | null
  lastResult?: SkillRunResult | null
  publishPlan?: EditorPublishPlan
  publisherReport?: EditorPublishReport | null
}

const layerY: Record<NarrativeMemory['layer'], number> = {
  'L2 风格': 72,
  'L0 事实': 136,
  'L3 意图': 200,
  'L1 剧情': 264,
}

export function buildStoryGraph(input: BuildStoryGraphInput): StoryGraph {
  const nodes: StoryGraphNode[] = []
  const edges: StoryGraphEdge[] = []
  const activeChapterId = input.activeChapter
    ? `chapter:${input.activeChapter.id}`
    : 'chapter:active'

  nodes.push({
    id: activeChapterId,
    kind: 'chapter',
    label: input.activeChapter?.title || '当前章节',
    detail: input.activeChapter?.path || 'active draft',
    x: 246,
    y: 176,
  })

  const layerCounts = new Map<NarrativeMemory['layer'], number>()

  input.runtimeMemoryPlan.memories.forEach((memory, index) => {
    const nodeId = `memory:${index}:${memory.source}`
    const sourceLabel = summarizeSource(memory.source)
    const layerIndex = layerCounts.get(memory.layer) || 0
    layerCounts.set(memory.layer, layerIndex + 1)

    nodes.push({
      id: nodeId,
      kind: 'memory',
      label: memory.layer,
      detail: sourceLabel,
      layer: memory.layer,
      x: 44,
      y: (layerY[memory.layer] || 96 + index * 48) + layerIndex * 32,
    })
    edges.push({
      id: `${nodeId}->${activeChapterId}`,
      from: nodeId,
      to: activeChapterId,
      label: '注入',
    })
  })

  input.codexEntries.slice(0, 4).forEach((entry, index) => {
    const nodeId = `codex:${entry.id}`
    nodes.push({
      id: nodeId,
      kind: 'codex',
      label: entry.name,
      detail: `${entry.type} · ${entry.path}`,
      x: 438,
      y: 72 + index * 56,
    })
    if (memorySourcesInclude(input.runtimeMemoryPlan.memories, entry.path, entry.id)) {
      edges.push({
        id: `${nodeId}->${activeChapterId}`,
        from: nodeId,
        to: activeChapterId,
        label: '事实',
      })
    }
  })

  input.plotThreads.slice(0, 3).forEach((thread, index) => {
    const nodeId = `plot:${thread.id}`
    nodes.push({
      id: nodeId,
      kind: 'plot_thread',
      label: thread.title,
      detail: `${thread.status} · ${thread.plantedChapterTitle}`,
      x: 438,
      y: 304 + index * 56,
    })
    if (memorySourcesInclude(input.runtimeMemoryPlan.memories, thread.id)) {
      edges.push({
        id: `${nodeId}->${activeChapterId}`,
        from: nodeId,
        to: activeChapterId,
        label: '召回',
      })
    }
  })

  const skillAudit = input.lastSkillAudit
  if (skillAudit) {
    const nodeId = `skill:${skillAudit.skill.id}`
    nodes.push({
      id: nodeId,
      kind: 'skill_run',
      label: skillAudit.skill.name,
      detail: summarizeSkillRun(skillAudit, input.lastResult),
      x: 246,
      y: 344,
    })

    input.runtimeMemoryPlan.memories.forEach((memory, index) => {
      if (!skillAuditUsesMemory(skillAudit, memory)) return

      const memoryNodeId = `memory:${index}:${memory.source}`
      edges.push({
        id: `${memoryNodeId}->${nodeId}`,
        from: memoryNodeId,
        to: nodeId,
        label: '输入',
      })
    })

    edges.push({
      id: `${nodeId}->${activeChapterId}`,
      from: nodeId,
      to: activeChapterId,
      label: skillAudit.skill.requiresReview ? '待审' : '产出',
    })
  }

  const publishNode = buildPublishNode(input.publishPlan, input.publisherReport)
  if (publishNode) {
    nodes.push(publishNode)
    const report = input.publisherReport
    edges.push({
      id: `${activeChapterId}->${publishNode.id}`,
      from: activeChapterId,
      to: publishNode.id,
      label: report ? (report.failed > 0 ? '异常' : '预检') : '待发布',
    })
  }

  return { nodes, edges }
}

export function getStoryGraphNodeContext(
  graph: StoryGraph,
  nodeId: string,
): StoryGraphNodeContext | undefined {
  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]))
  const node = nodeById.get(nodeId)
  if (!node) return undefined

  const incoming = graph.edges.flatMap((edge) => {
    if (edge.to !== nodeId) return []
    const sourceNode = nodeById.get(edge.from)
    return sourceNode ? [{ edge, node: sourceNode }] : []
  })

  const outgoing = graph.edges.flatMap((edge) => {
    if (edge.from !== nodeId) return []
    const targetNode = nodeById.get(edge.to)
    return targetNode ? [{ edge, node: targetNode }] : []
  })

  return {
    node,
    incoming,
    outgoing,
  }
}

export function filterStoryGraphByView(
  graph: StoryGraph,
  view: StoryGraphView,
): StoryGraph {
  if (view === 'all') return graph

  const focusNodeIds = new Set(
    graph.nodes.filter((node) => node.kind === view).map((node) => node.id),
  )
  const visibleNodeIds = new Set(
    graph.nodes
      .filter((node) => node.kind === 'chapter' || focusNodeIds.has(node.id))
      .map((node) => node.id),
  )

  graph.edges.forEach((edge) => {
    if (!focusNodeIds.has(edge.from) && !focusNodeIds.has(edge.to)) return

    visibleNodeIds.add(edge.from)
    visibleNodeIds.add(edge.to)
  })

  return {
    nodes: graph.nodes.filter((node) => visibleNodeIds.has(node.id)),
    edges: graph.edges.filter(
      (edge) => visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to),
    ),
  }
}

export function summarizeStoryGraph(
  graph: StoryGraph,
  visibleGraph: StoryGraph = graph,
): StoryGraphViewSummary {
  const nodesByKind = emptyNodeKindCounts()
  const memoryLayers: Partial<Record<NarrativeMemory['layer'], number>> = {}

  graph.nodes.forEach((node) => {
    nodesByKind[node.kind] += 1
    if (node.kind === 'memory' && node.layer) {
      memoryLayers[node.layer] = (memoryLayers[node.layer] || 0) + 1
    }
  })

  return {
    totalNodes: graph.nodes.length,
    totalEdges: graph.edges.length,
    visibleNodes: visibleGraph.nodes.length,
    visibleEdges: visibleGraph.edges.length,
    nodesByKind,
    memoryLayers,
  }
}

function emptyNodeKindCounts(): Record<StoryGraphNodeKind, number> {
  return {
    chapter: 0,
    memory: 0,
    codex: 0,
    plot_thread: 0,
    skill_run: 0,
    publish_job: 0,
  }
}

function memorySourcesInclude(
  memories: NarrativeMemory[],
  ...needles: (string | undefined)[]
) {
  const actualNeedles = needles.filter(Boolean) as string[]

  return memories.some((memory) =>
    actualNeedles.some((needle) => memory.source.includes(needle)),
  )
}

function summarizeSource(source: string) {
  return source
    .split(/[;,]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2)
    .join(' · ')
}

function skillAuditUsesMemory(audit: SkillRunAudit, memory: NarrativeMemory) {
  return audit.memorySources.includes(`${memory.layer}:${memory.source}`)
}

function summarizeSkillRun(
  audit: SkillRunAudit,
  result?: SkillRunResult | null,
) {
  const output = result?.type || audit.skill.outputMode
  const review = audit.skill.requiresReview ? 'review required' : 'review optional'

  return [
    `${audit.skill.id}@${audit.skill.version}`,
    audit.provider.label,
    output,
    review,
    `${audit.context.memoryCount} memories`,
  ].join(' · ')
}

function buildPublishNode(
  publishPlan?: EditorPublishPlan,
  publisherReport?: EditorPublishReport | null,
): StoryGraphNode | undefined {
  const reportChapter = publisherReport?.results[0]?.chapter
  const nextChapter = publishPlan?.pending[0]
  const chapter = reportChapter || nextChapter

  if (!chapter && !publisherReport) return undefined

  const adapterId = publisherReport?.adapterId || 'publisher'
  const status = publisherReport
    ? `attempted:${publisherReport.attempted} · succeeded:${publisherReport.succeeded} · failed:${publisherReport.failed}`
    : `pending:${publishPlan?.pending.length || 0} · scanned:${publishPlan?.scanned || 0}`
  const chapterLabel = chapter ? `第 ${chapter.number} 章 · ${chapter.title}` : '发布队列'

  return {
    id: `publish:${adapterId}:${chapter?.id || 'queue'}`,
    kind: 'publish_job',
    label: `${adapterId} 预检`,
    detail: `${chapterLabel} · ${status}`,
    x: 438,
    y: 360,
  }
}
