import type { ModelProvider } from '@/ai/provider'
import type { ProviderAdapterCatalog } from '@/ai/providerCatalog'
import type { ProviderAdapterManifest } from '@/ai/providerManifest'
import { validateRewritePatch } from '@/diff/safeRewrite'
import {
  buildStoryGraph,
  getStoryGraphNodeContext,
  type StoryGraph,
  type StoryGraphNodeKind,
} from '@/inspector/storyGraph'
import {
  buildNarrativeMemoryPlan,
  type NarrativeMemoryPlan,
} from '@/memory/memoryContextBuilder'
import {
  buildMemorySourceSummary,
  memorySourceRefs,
  type MemorySourceFamilySummary,
} from '@/memory/memorySourceSummary'
import type { ChapterSummary } from '@/memory/chapterSummaryStore'
import type { CharacterStateLog } from '@/memory/characterStateLogStore'
import type { PlotThread } from '@/memory/plotThreadStore'
import type { VolumeSummary } from '@/memory/volumeSummaryStore'
import type { ChapterDraftStore } from '@/project/chapterDraftStore'
import type { NovelProject, ProjectChapter } from '@/project/projectTypes'
import {
  buildEditorPublishPlan,
  runEditorPublisherDryRun,
  type EditorPublishReport,
  type EditorPublisherAdapterCatalog,
} from '@/publisher/editorPublisher'
import type { SkillCatalog } from '@/skills/skillCatalog'
import {
  previewSkillRun,
  runSkillWithProvider,
  type SkillRunAudit,
} from '@/skills/skillRuntime'
import type {
  MemoryUpdateProposal,
  RewritePatch,
  SkillManifest,
  SkillRunResult,
} from '@/types/domain'
import {
  parseNovelAgentToolInput,
  type NovelAgentToolInputs,
  type NovelAgentToolName,
  type NovelAgentToolPolicy,
} from './novelAgentTools'

export type NovelAgentRuntimeContext = {
  project: NovelProject
  draftStore: ChapterDraftStore
  activeChapterId?: string
  selectedText?: string
  chapterSummaries?: ChapterSummary[]
  volumeSummaries?: VolumeSummary[]
  characterStateLogs?: CharacterStateLog[]
  plotThreads?: PlotThread[]
  skillCatalog?: SkillCatalog
  provider?: ModelProvider
  providerAdapterCatalog?: ProviderAdapterCatalog
  publisherAdapterCatalog?: EditorPublisherAdapterCatalog
  publisherReport?: EditorPublishReport | null
  memoryBudgetChars?: number
}

export type NovelAgentToolResult =
  | {
      tool: 'novel_get_project_state'
      project: {
        title: string
        sourceOfTruth: NovelProject['sourceOfTruth']
        rootPath?: string
        chapterCount: number
        codexCount: number
      }
      chapters?: ChapterStateSummary[]
      codex?: CodexStateSummary[]
      providers?: ProviderAdapterStateSummary
      publisher?: PublisherStateSummary
      skillCatalog?: SkillCatalogStateSummary
    }
  | {
      tool: 'novel_get_current_chapter'
      chapter: ChapterStateSummary & {
        content?: string
        draft?: {
          content: string
          status: string
          savedAt?: string
        }
      }
    }
  | {
      tool: 'novel_get_memory_plan'
      chapterId: string
      plan: NarrativeMemoryPlan
      filter: MemoryPlanFilterSummary
    }
  | {
      tool: 'novel_list_story_graph_nodes'
      graph: StoryGraph
      selected?: ReturnType<typeof getStoryGraphNodeContext>
    }
  | {
      tool: 'novel_run_skill'
      result: SkillRunResult
      audit: SkillRunAudit
      reviewRequired: boolean
    }
  | {
      tool: 'novel_propose_rewrite_patch'
      patch: RewritePatch
      validation: ReturnType<typeof validateRewritePatch>
      reviewRequired: true
    }
  | {
      tool: 'novel_propose_memory_update'
      proposal: MemoryUpdateProposal
      evidence: string
      reviewRequired: true
    }
  | {
      tool: 'novel_run_publisher_dry_run'
      report: EditorPublishReport
      dryRunOnly: true
    }

export type NovelAgentToolExecution = {
  name: NovelAgentToolName
  policy: NovelAgentToolPolicy
  input: NovelAgentToolInputs[NovelAgentToolName]
  result: NovelAgentToolResult
}

type ChapterStateSummary = {
  id: string
  title: string
  order: number
  status: ProjectChapter['status']
  path: string
  wordCount: number
  draftStatus?: string
}

type CodexStateSummary = {
  id: string
  name: string
  type: string
  path: string
  keywords: string[]
}

type PublisherStateSummary = {
  adapters: {
    id: string
    displayName: string
    status: string
    source?: string
    path?: string
    editorDryRun: boolean
  }[]
  errors: string[]
  plan: {
    scanned: number
    skipped: number
    pending: number
    nextChapter?: {
      number: number
      title: string
      wordCount: number
    }
  }
}

type ProviderAdapterStateSummary = {
  adapters: {
    id: string
    label: string
    kind: ProviderAdapterManifest['kind']
    status: ProviderAdapterManifest['status']
    sourceKind?: ProviderAdapterManifest['sourceKind']
    path?: string
    configFields: ProviderAdapterManifest['configFields']
    capabilities: string[]
  }[]
  errors: string[]
}

type SkillCatalogStateSummary = {
  skills: {
    id: string
    name: string
    version: string
    outputMode: SkillManifest['outputMode']
    riskLevel: SkillManifest['riskLevel']
    requiresReview: boolean
    source: string
    path?: string
  }[]
  errors: string[]
}

type MemoryPlanFilterSummary = {
  includeLayers?: NovelAgentToolInputs['novel_get_memory_plan']['includeLayers']
  sourceFamilies?: NovelAgentToolInputs['novel_get_memory_plan']['sourceFamilies']
  sourceContains?: NovelAgentToolInputs['novel_get_memory_plan']['sourceContains']
  originalMemoryCount: number
  returnedMemoryCount: number
  originalSourceSummary: MemorySourceFamilySummary[]
  returnedSourceSummary: MemorySourceFamilySummary[]
  filtered: boolean
}

export function createNovelAgentToolRuntime(context: NovelAgentRuntimeContext) {
  async function runTool(
    name: NovelAgentToolName,
    rawInput: unknown = {},
  ): Promise<NovelAgentToolExecution> {
    const input = parseNovelAgentToolInput(name, rawInput)
    const policy = policyForTool(name)
    const result = await executeTool(context, name, input)

    return {
      name,
      policy,
      input,
      result,
    }
  }

  return { runTool }
}

async function executeTool(
  context: NovelAgentRuntimeContext,
  name: NovelAgentToolName,
  input: NovelAgentToolInputs[NovelAgentToolName],
): Promise<NovelAgentToolResult> {
  switch (name) {
    case 'novel_get_project_state':
      return getProjectState(
        context,
        input as NovelAgentToolInputs['novel_get_project_state'],
      )
    case 'novel_get_current_chapter':
      return getCurrentChapter(
        context,
        input as NovelAgentToolInputs['novel_get_current_chapter'],
      )
    case 'novel_get_memory_plan':
      return getMemoryPlan(
        context,
        input as NovelAgentToolInputs['novel_get_memory_plan'],
      )
    case 'novel_list_story_graph_nodes':
      return listStoryGraphNodes(
        context,
        input as NovelAgentToolInputs['novel_list_story_graph_nodes'],
      )
    case 'novel_run_skill':
      return runSkillTool(context, input as NovelAgentToolInputs['novel_run_skill'])
    case 'novel_propose_rewrite_patch':
      return proposeRewritePatch(
        context,
        input as NovelAgentToolInputs['novel_propose_rewrite_patch'],
      )
    case 'novel_propose_memory_update':
      return proposeMemoryUpdate(
        input as NovelAgentToolInputs['novel_propose_memory_update'],
      )
    case 'novel_run_publisher_dry_run':
      return runPublisherDryRunTool(
        context,
        input as NovelAgentToolInputs['novel_run_publisher_dry_run'],
      )
  }
}

function getProjectState(
  context: NovelAgentRuntimeContext,
  input: NovelAgentToolInputs['novel_get_project_state'],
): NovelAgentToolResult {
  const publishPlan = buildEditorPublishPlan({
    project: context.project,
    draftStore: context.draftStore,
  })

  return {
    tool: 'novel_get_project_state',
    project: {
      title: context.project.title,
      sourceOfTruth: context.project.sourceOfTruth,
      rootPath: context.project.rootPath,
      chapterCount: context.project.chapters.length,
      codexCount: context.project.codexEntries.length,
    },
    chapters: input.includeChapters
      ? context.project.chapters.map((chapter) =>
          summarizeChapter(context, chapter),
        )
      : undefined,
    codex: input.includeCodex
      ? context.project.codexEntries.map((entry) => ({
          id: entry.id,
          name: entry.name,
          type: entry.type,
          path: entry.path,
          keywords: entry.keywords,
        }))
      : undefined,
    publisher: input.includePublisher
      ? {
          adapters:
            context.publisherAdapterCatalog?.adapters.map((adapter) => ({
              id: adapter.id,
              displayName: adapter.displayName,
              status: adapter.status,
              source: adapter.source,
              path: adapter.path,
              editorDryRun: adapter.runtime.editorDryRun,
            })) || [],
          errors: context.publisherAdapterCatalog?.errors || [],
          plan: {
            scanned: publishPlan.scanned,
            skipped: publishPlan.skipped,
            pending: publishPlan.pending.length,
            nextChapter: publishPlan.pending[0]
              ? {
                  number: publishPlan.pending[0].number,
                  title: publishPlan.pending[0].title,
                  wordCount: publishPlan.pending[0].wordCount,
                }
              : undefined,
          },
        }
      : undefined,
    providers: input.includeProviders
      ? {
          adapters:
            context.providerAdapterCatalog?.adapters.map((adapter) => ({
              id: adapter.id,
              label: adapter.label,
              kind: adapter.kind,
              status: adapter.status,
              sourceKind: adapter.sourceKind,
              path: adapter.path,
              configFields: adapter.configFields,
              capabilities: adapter.capabilities,
            })) || [],
          errors: context.providerAdapterCatalog?.errors || [],
        }
      : undefined,
    skillCatalog: input.includeSkillCatalog
      ? {
          skills:
            context.skillCatalog?.skills.map((entry) => ({
              id: entry.manifest.id,
              name: entry.manifest.name,
              version: entry.manifest.version,
              outputMode: entry.manifest.outputMode,
              riskLevel: entry.manifest.riskLevel,
              requiresReview: entry.manifest.requiresReview,
              source: entry.source,
              path: entry.path,
            })) || [],
          errors: context.skillCatalog?.errors || [],
        }
      : undefined,
  }
}

function getCurrentChapter(
  context: NovelAgentRuntimeContext,
  input: NovelAgentToolInputs['novel_get_current_chapter'],
): NovelAgentToolResult {
  const chapter = getActiveChapter(context)
  const draft = context.draftStore.getDraft(chapter.id)

  return {
    tool: 'novel_get_current_chapter',
    chapter: {
      ...summarizeChapter(context, chapter),
      content: input.includeContent ? chapter.content : undefined,
      draft:
        input.includeDraft && draft
          ? {
              content: draft.content,
              status: draft.status,
              savedAt: draft.savedAt,
            }
          : undefined,
    },
  }
}

function getMemoryPlan(
  context: NovelAgentRuntimeContext,
  input: NovelAgentToolInputs['novel_get_memory_plan'],
): NovelAgentToolResult {
  const chapter = input.chapterId
    ? getChapterById(context, input.chapterId)
    : getActiveChapter(context)
  const plan = buildMemoryPlan(context, chapter, input.budgetChars)
  const filteredPlan = filterMemoryPlan(plan, {
    includeLayers: input.includeLayers,
    sourceFamilies: input.sourceFamilies,
    sourceContains: input.sourceContains,
  })
  const originalSourceSummary = buildMemorySourceSummary(plan.memories)
  const returnedSourceSummary =
    filteredPlan === plan
      ? originalSourceSummary
      : buildMemorySourceSummary(filteredPlan.memories)

  return {
    tool: 'novel_get_memory_plan',
    chapterId: chapter.id,
    plan: filteredPlan,
    filter: {
      includeLayers: input.includeLayers,
      sourceFamilies: input.sourceFamilies,
      sourceContains: input.sourceContains,
      originalMemoryCount: plan.memories.length,
      returnedMemoryCount: filteredPlan.memories.length,
      originalSourceSummary,
      returnedSourceSummary,
      filtered: filteredPlan.memories.length !== plan.memories.length,
    },
  }
}

function filterMemoryPlan(
  plan: NarrativeMemoryPlan,
  filters: Pick<
    NovelAgentToolInputs['novel_get_memory_plan'],
    'includeLayers' | 'sourceFamilies' | 'sourceContains'
  >,
): NarrativeMemoryPlan {
  const memories = plan.memories.filter((memory) => {
    const layerMatches =
      !filters.includeLayers || filters.includeLayers.includes(memory.layer)
    const sourceFamilyMatches =
      !filters.sourceFamilies ||
      memorySourceRefs(memory.source).some((ref) =>
        filters.sourceFamilies?.includes(ref.family),
      )
    const sourceMatches =
      !filters.sourceContains ||
      filters.sourceContains.some((needle) => memory.source.includes(needle))

    return layerMatches && sourceFamilyMatches && sourceMatches
  })

  return memories.length === plan.memories.length ? plan : { ...plan, memories }
}

function listStoryGraphNodes(
  context: NovelAgentRuntimeContext,
  input: NovelAgentToolInputs['novel_list_story_graph_nodes'],
): NovelAgentToolResult {
  const chapter = getActiveChapter(context)
  const graph = buildGraph(context, chapter)
  const filteredGraph = input.kind
    ? filterGraphByKind(graph, input.kind)
    : graph

  return {
    tool: 'novel_list_story_graph_nodes',
    graph: input.includeEdges
      ? filteredGraph
      : { nodes: filteredGraph.nodes, edges: [] },
    selected: input.selectedOnly
      ? getStoryGraphNodeContext(graph, `chapter:${chapter.id}`)
      : undefined,
  }
}

async function runSkillTool(
  context: NovelAgentRuntimeContext,
  input: NovelAgentToolInputs['novel_run_skill'],
): Promise<NovelAgentToolResult> {
  if (!context.provider) {
    throw new Error('Novel Agent runtime requires a provider to run Skills.')
  }

  const skill = getSkillById(context, input.skillId)
  const chapter = getActiveChapter(context)
  const memoryPlan = buildMemoryPlan(context, chapter)
  const preview = previewSkillRun({
    documentText: draftContentForChapter(context, chapter),
    selectedText: input.selectedText ?? context.selectedText ?? '',
    chapterTitle: chapter.title,
    memories: memoryPlan.memories,
    skill,
    provider: context.provider,
    userInstruction: input.userInstruction,
  })
  const result = await runSkillWithProvider(skill, preview.context, context.provider)

  return {
    tool: 'novel_run_skill',
    result,
    audit: preview.audit,
    reviewRequired: skill.requiresReview,
  }
}

function proposeRewritePatch(
  context: NovelAgentRuntimeContext,
  input: NovelAgentToolInputs['novel_propose_rewrite_patch'],
): NovelAgentToolResult {
  const chapter = getActiveChapter(context)
  const patch: RewritePatch = {
    original: input.original,
    proposed: input.proposed,
    skillId: input.skillId || 'agent.proposed_rewrite',
    requiresSnapshot: true,
  }

  return {
    tool: 'novel_propose_rewrite_patch',
    patch,
    validation: validateRewritePatch(draftContentForChapter(context, chapter), patch),
    reviewRequired: true,
  }
}

function proposeMemoryUpdate(
  input: NovelAgentToolInputs['novel_propose_memory_update'],
): NovelAgentToolResult {
  return {
    tool: 'novel_propose_memory_update',
    proposal: normalizeMemoryUpdateProposal(input),
    evidence: input.evidence,
    reviewRequired: true,
  }
}

async function runPublisherDryRunTool(
  context: NovelAgentRuntimeContext,
  input: NovelAgentToolInputs['novel_run_publisher_dry_run'],
): Promise<NovelAgentToolResult> {
  const report = await runEditorPublisherDryRun({
    adapterId: input.adapterId,
    project: context.project,
    draftStore: context.draftStore,
    limit: input.limit,
    adapters: context.publisherAdapterCatalog?.adapters,
  })

  return {
    tool: 'novel_run_publisher_dry_run',
    report,
    dryRunOnly: true,
  }
}

function summarizeChapter(
  context: NovelAgentRuntimeContext,
  chapter: ProjectChapter,
): ChapterStateSummary {
  const draft = context.draftStore.getDraft(chapter.id)

  return {
    id: chapter.id,
    title: chapter.title,
    order: chapter.order,
    status: chapter.status,
    path: chapter.path,
    wordCount: countNonWhitespace(draft?.content || chapter.content),
    draftStatus: draft?.status,
  }
}

function buildMemoryPlan(
  context: NovelAgentRuntimeContext,
  chapter: ProjectChapter,
  budgetChars = context.memoryBudgetChars || 900,
) {
  return buildNarrativeMemoryPlan({
    chapter,
    projectChapters: context.project.chapters,
    documentText: draftContentForChapter(context, chapter),
    codexEntries: context.project.codexEntries,
    chapterSummaries: context.chapterSummaries || [],
    volumeSummaries: context.volumeSummaries || [],
    characterStateLogs: context.characterStateLogs || [],
    plotThreads: context.plotThreads || [],
    projectTitle: context.project.title,
    budgetChars,
  })
}

function buildGraph(context: NovelAgentRuntimeContext, chapter: ProjectChapter) {
  return buildStoryGraph({
    activeChapter: chapter,
    runtimeMemoryPlan: buildMemoryPlan(context, chapter),
    codexEntries: context.project.codexEntries,
    plotThreads: context.plotThreads || [],
    publishPlan: buildEditorPublishPlan({
      project: context.project,
      draftStore: context.draftStore,
    }),
    publisherReport: context.publisherReport,
  })
}

function filterGraphByKind(graph: StoryGraph, kind: StoryGraphNodeKind): StoryGraph {
  const nodes = graph.nodes.filter((node) => node.kind === kind)
  const nodeIds = new Set(nodes.map((node) => node.id))

  return {
    nodes,
    edges: graph.edges.filter(
      (edge) => nodeIds.has(edge.from) && nodeIds.has(edge.to),
    ),
  }
}

function normalizeMemoryUpdateProposal(
  input: NovelAgentToolInputs['novel_propose_memory_update'],
): MemoryUpdateProposal {
  if (input.kind === 'plot_thread') {
    return {
      kind: 'plot_thread',
      title: input.title,
      content: stringPayload(input.payload, 'content') || input.title,
      keywords: stringArrayPayload(input.payload, 'keywords'),
      relatedCharacters: stringArrayPayload(input.payload, 'relatedCharacters'),
      evidence: input.evidence,
      confidence: input.confidence,
    }
  }

  return {
    kind: 'character_state',
    characterName: stringPayload(input.payload, 'characterName') || input.title,
    field: stringPayload(input.payload, 'field') || input.title,
    from: stringPayload(input.payload, 'from'),
    to: stringPayload(input.payload, 'to') || input.title,
    reason: stringPayload(input.payload, 'reason') || input.evidence,
    evidence: input.evidence,
    confidence: input.confidence,
  }
}

function policyForTool(name: NovelAgentToolName): NovelAgentToolPolicy {
  if (name === 'novel_run_publisher_dry_run') {
    return { risk: 'dry_run', requiresReview: false, dryRunOnly: true }
  }

  if (
    name === 'novel_run_skill' ||
    name === 'novel_propose_rewrite_patch' ||
    name === 'novel_propose_memory_update'
  ) {
    return { risk: 'reviewed_write', requiresReview: true }
  }

  return { risk: 'read', requiresReview: false }
}

function getActiveChapter(context: NovelAgentRuntimeContext) {
  const chapter =
    context.project.chapters.find(
      (candidate) => candidate.id === context.activeChapterId,
    ) || context.project.chapters[0]

  if (!chapter) {
    throw new Error('Novel Agent runtime requires at least one chapter.')
  }

  return chapter
}

function getChapterById(context: NovelAgentRuntimeContext, chapterId: string) {
  const chapter = context.project.chapters.find(
    (candidate) => candidate.id === chapterId,
  )

  if (!chapter) {
    throw new Error(`Unknown chapter: ${chapterId}`)
  }

  return chapter
}

function getSkillById(context: NovelAgentRuntimeContext, skillId: string) {
  const skill = context.skillCatalog?.skills.find(
    (entry) => entry.manifest.id === skillId,
  )?.manifest

  if (!skill) {
    throw new Error(`Unknown Skill: ${skillId}`)
  }

  return skill
}

function draftContentForChapter(
  context: NovelAgentRuntimeContext,
  chapter: ProjectChapter,
) {
  return context.draftStore.getDraft(chapter.id)?.content || chapter.content
}

function countNonWhitespace(value: string) {
  return value.replace(/\s/g, '').length
}

function stringPayload(payload: Record<string, unknown>, key: string) {
  const value = payload[key]

  return typeof value === 'string' && value.trim() ? value : undefined
}

function stringArrayPayload(payload: Record<string, unknown>, key: string) {
  const value = payload[key]

  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : []
}
