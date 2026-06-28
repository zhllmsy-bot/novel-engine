import { useEffect, useMemo, useRef, useState } from 'react'
import {
  BookOpen,
  Boxes,
  Braces,
  FileClock,
  FileText,
  GitBranch,
  LibraryBig,
  PenLine,
  Plug,
  Save,
  Send,
  FolderOpen,
  UploadCloud,
  X,
} from 'lucide-react'
import './App.css'
import {
  createNovelAgentToolRuntime,
  type NovelAgentToolExecution,
  type NovelAgentToolResult,
} from './agent-tools/novelAgentRuntime'
import type { NovelAgentToolName } from './agent-tools/novelAgentTools'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { TooltipProvider } from '@/components/ui/tooltip'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  listProviderAdapterManifests,
  loadProjectProviderAdapterCatalog,
  type ProviderAdapterCatalog,
} from './ai/providerCatalog'
import {
  createModelProvider,
  defaultProviderConfig,
  getDefaultProviderAdapterId,
  type ProviderConfig,
  validateProviderConfig,
} from './ai/providerRuntime'
import {
  applyLoadedProviderApiKey,
  createProviderSecretStore,
  loadProviderSettings,
  saveProviderSettings,
} from './ai/providerSettingsPersistence'
import {
  acceptRewriteUnitInPatch,
  applyRewritePatch,
  applyRewriteUnit,
  buildDiffParts,
  buildRewriteUnits,
  rejectRewriteUnitInPatch,
  validateRewritePatch,
} from './diff/safeRewrite'
import { MarkdownEditor } from './editor/MarkdownEditor'
import { NarrativeInspector } from './inspector/NarrativeInspector'
import {
  plotThreadProposalKey,
  stateProposalKey,
} from './inspector/proposalKeys'
import type { StoryGraphSnapshot } from './inspector/storyGraphSnapshot'
import {
  createMemoryChapterSummaryStore,
  type ChapterSummary,
} from './memory/chapterSummaryStore'
import {
  createCharacterStateLogStore,
  type CharacterStateLog,
} from './memory/characterStateLogStore'
import {
  buildNarrativeMemoryPlan,
  type IndexedRecallResult,
} from './memory/memoryContextBuilder'
import {
  createPlotThreadStore,
  type PlotThread,
  type PlotThreadProposal,
} from './memory/plotThreadStore'
import {
  buildLocalVolumeSummaries,
  chapterSummariesForVolume,
  createMemoryVolumeSummaryStore,
  volumeIdForChapter,
  type VolumeSummary,
} from './memory/volumeSummaryStore'
import { createChapterDraftStore } from './project/chapterDraftStore'
import { createCharacterStateLogPersistence } from './project/characterStateLogPersistence'
import { createChapterSummaryPersistence } from './project/chapterSummaryPersistence'
import { createChapterVersionPersistence } from './project/chapterVersionPersistence'
import { loadDemoProject } from './project/demoProjectRepository'
import { createGraphSnapshotPersistence } from './project/graphSnapshotPersistence'
import { createPlotThreadPersistence } from './project/plotThreadPersistence'
import { createProjectPersistence } from './project/projectPersistence'
import { pickAndLoadTauriProject } from './project/tauriProjectRepository'
import { createVolumeSummaryPersistence } from './project/volumeSummaryPersistence'
import type { CodexEntry, ProjectChapter } from './project/projectTypes'
import {
  searchProjectChapterIndex,
  type ChapterSearchResult,
} from './platform/tauriProject'
import {
  buildEditorPublishPlan,
  getDefaultEditorDryRunAdapterId,
  listEditorPublisherAdapters,
  loadProjectPublisherAdapterCatalog,
  runEditorPublisherDryRun,
  type EditorPublishReport,
  type EditorPublisherAdapterCatalog,
} from './publisher/editorPublisher'
import {
  findChapterSummarySkill,
  findRewriteSkill,
  loadProjectSkillCatalog,
  loadSkillCatalog,
} from './skills/skillCatalog'
import {
  previewSkillRun,
  runSkillWithProvider,
  type SkillRunAudit,
} from './skills/skillRuntime'
import type {
  CharacterStateChangeProposal,
  PlotThreadChangeProposal,
  RewritePatch,
  SkillManifest,
  SkillRunResult,
} from './types/domain'
import {
  createMemoryChapterVersionStore,
  type ChapterVersion,
} from './versioning/chapterVersionStore'

type WorkspaceState = ReturnType<typeof createWorkspaceState>
type InitialProviderSettings = NonNullable<ReturnType<typeof loadProviderSettings>>

function loadInitialProviderSettings(): InitialProviderSettings {
  const settings = loadProviderSettings()
  const adapters = listProviderAdapterManifests()
  const providerMode =
    settings && adapters.some((adapter) => adapter.id === settings.providerMode)
      ? settings.providerMode
      : getDefaultProviderAdapterId(adapters)

  return {
    providerMode,
    providerConfig: settings?.providerConfig || defaultProviderConfig,
  }
}

function createWorkspaceState(
  project = loadDemoProject(),
  chapterSummaries: ChapterSummary[] = [],
  chapterVersions: ChapterVersion[] = [],
  characterStateLogs: CharacterStateLog[] = [],
  plotThreads: PlotThread[] = [],
  volumeSummaries: VolumeSummary[] = buildLocalVolumeSummaries({
    projectChapters: project.chapters,
    chapterSummaries,
  }),
) {
  return {
    project,
    draftStore: createChapterDraftStore(project.chapters),
    summaryStore: createMemoryChapterSummaryStore(chapterSummaries),
    volumeSummaryStore: createMemoryVolumeSummaryStore(volumeSummaries),
    versionStore: createMemoryChapterVersionStore(chapterVersions),
    stateLogStore: createCharacterStateLogStore(characterStateLogs),
    plotThreadStore: createPlotThreadStore(plotThreads),
  }
}

function App() {
  const [workspace, setWorkspace] = useState<WorkspaceState>(() =>
    createWorkspaceState(),
  )
  const {
    project,
    draftStore,
    summaryStore,
    volumeSummaryStore,
    versionStore,
    stateLogStore,
    plotThreadStore,
  } = workspace
  const [projectPersistence] = useState(createProjectPersistence)
  const [summaryPersistence] = useState(createChapterSummaryPersistence)
  const [versionPersistence] = useState(createChapterVersionPersistence)
  const [stateLogPersistence] = useState(createCharacterStateLogPersistence)
  const [plotThreadPersistence] = useState(createPlotThreadPersistence)
  const [volumeSummaryPersistence] = useState(createVolumeSummaryPersistence)
  const [graphSnapshotPersistence] = useState(createGraphSnapshotPersistence)
  const [providerSecretStore] = useState(createProviderSecretStore)
  const [skillCatalog, setSkillCatalog] = useState(loadSkillCatalog)
  const [publisherAdapterCatalog, setPublisherAdapterCatalog] =
    useState<EditorPublisherAdapterCatalog>(() => ({
      adapters: listEditorPublisherAdapters(),
      errors: [],
    }))
  const [providerAdapterCatalog, setProviderAdapterCatalog] =
    useState<ProviderAdapterCatalog>(() => ({
      adapters: listProviderAdapterManifests(),
      errors: [],
    }))
  const [activeChapterId, setActiveChapterId] = useState(
    () => project.chapters[0]?.id || '',
  )
  const activeChapter =
    project.chapters.find((chapter) => chapter.id === activeChapterId) ||
    project.chapters[0]
  const activeChapterContent = activeChapter?.content || ''
  const [documentText, setDocumentText] = useState(
    () => activeChapterContent,
  )
  const [selectedText, setSelectedText] = useState('')
  const [rewritePatch, setRewritePatch] = useState<RewritePatch | null>(null)
  const [lastResult, setLastResult] = useState<SkillRunResult | null>(null)
  const [lastSkillAudit, setLastSkillAudit] = useState<SkillRunAudit | null>(
    null,
  )
  const [agentToolExecution, setAgentToolExecution] =
    useState<NovelAgentToolExecution | null>(null)
  const [agentToolRunning, setAgentToolRunning] =
    useState<NovelAgentToolName | null>(null)
  const [runningSkillId, setRunningSkillId] = useState<string | null>(null)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [savingChapterId, setSavingChapterId] = useState<string | null>(null)
  const [, setDraftRevision] = useState(0)
  const [, setSummaryRevision] = useState(0)
  const [, setVolumeSummaryRevision] = useState(0)
  const [, setVersionRevision] = useState(0)
  const [, setStateLogRevision] = useState(0)
  const [, setPlotThreadRevision] = useState(0)
  const [publisherRunning, setPublisherRunning] = useState(false)
  const [publisherReport, setPublisherReport] =
    useState<EditorPublishReport | null>(null)
  const [activePublisherAdapterId, setActivePublisherAdapterId] = useState(
    getDefaultEditorDryRunAdapterId,
  )
  const [acceptedStateProposalKeys, setAcceptedStateProposalKeys] = useState(
    () => new Set<string>(),
  )
  const [acceptedPlotThreadProposalKeys, setAcceptedPlotThreadProposalKeys] =
    useState(() => new Set<string>())
  const [initialProviderSettings] = useState(loadInitialProviderSettings)
  const [providerMode, setProviderMode] = useState(
    () => initialProviderSettings.providerMode,
  )
  const [providerConfig, setProviderConfig] = useState(
    () => initialProviderSettings.providerConfig,
  )
  const providerApiKeyEditRevision = useRef(0)
  const [graphSnapshot, setGraphSnapshot] =
    useState<StoryGraphSnapshot | null>(null)
  const [indexedRecallResults, setIndexedRecallResults] = useState<
    IndexedRecallResult[]
  >([])
  const indexedRecallQuery = useMemo(
    () => buildIndexedRecallQuery(documentText, project.codexEntries),
    [documentText, project.codexEntries],
  )
  const [debouncedIndexedRecallQuery, setDebouncedIndexedRecallQuery] =
    useState(indexedRecallQuery)

  useEffect(() => {
    setActiveChapterId(project.chapters[0]?.id || '')
  }, [project])

  useEffect(() => {
    const draft = activeChapter ? draftStore.getDraft(activeChapter.id) : undefined
    setDocumentText(draft?.content || activeChapterContent)
    setSelectedText('')
    setLastResult(null)
    setLastSkillAudit(null)
    setRewritePatch(null)
    setRuntimeError(null)
    setAgentToolExecution(null)
  }, [activeChapter, activeChapterContent, draftStore])

  useEffect(() => {
    if (!project.rootPath) return

    let isMounted = true

    void Promise.all([
      loadProjectSkillCatalog({ projectRoot: project.rootPath }),
      loadProjectPublisherAdapterCatalog({ projectRoot: project.rootPath }),
      loadProjectProviderAdapterCatalog({ projectRoot: project.rootPath }),
    ]).then(([catalog, publisherCatalog, providerCatalog]) => {
      if (isMounted) {
        setSkillCatalog(catalog)
        setPublisherAdapterCatalog(publisherCatalog)
        setProviderAdapterCatalog(providerCatalog)
        setActivePublisherAdapterId(
          getDefaultEditorDryRunAdapterId(publisherCatalog.adapters),
        )
        setProviderMode((current) =>
          providerCatalog.adapters.some((adapter) => adapter.id === current)
            ? current
            : getDefaultProviderAdapterId(providerCatalog.adapters),
        )
      }
    })

    return () => {
      isMounted = false
    }
  }, [project.rootPath])

  useEffect(() => {
    saveProviderSettings({
      providerMode,
      providerConfig,
    })
  }, [providerConfig, providerMode])

  useEffect(() => {
    let isMounted = true
    const loadRevision = providerApiKeyEditRevision.current

    setProviderConfig((current) => ({
      ...current,
      apiKey: '',
    }))

    providerSecretStore
      .getApiKey(providerMode)
      .then((apiKey) => {
        if (!isMounted) return
        setProviderConfig((current) =>
          applyLoadedProviderApiKey({
            providerConfig: current,
            loadedApiKey: apiKey,
            loadRevision,
            currentRevision: providerApiKeyEditRevision.current,
          }),
        )
      })
      .catch((error) => {
        if (!isMounted) return
        setRuntimeError(
          `读取 Provider API Key 失败: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      })

    return () => {
      isMounted = false
    }
  }, [providerMode, providerSecretStore])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedIndexedRecallQuery(indexedRecallQuery)
    }, 250)

    return () => window.clearTimeout(timeoutId)
  }, [indexedRecallQuery])

  useEffect(() => {
    if (!project.rootPath || !activeChapter || !debouncedIndexedRecallQuery) {
      setIndexedRecallResults([])
      return
    }

    let isMounted = true

    searchProjectChapterIndex(project.rootPath, debouncedIndexedRecallQuery, 8)
      .then((results) => {
        if (!isMounted) return
        setIndexedRecallResults(mapChapterSearchResults(results))
      })
      .catch((error) => {
        if (!isMounted) return
        setIndexedRecallResults([])
        setRuntimeError(
          `章节索引召回失败: ${
            error instanceof Error ? error.message : String(error)
          }`,
        )
      })

    return () => {
      isMounted = false
    }
  }, [activeChapter, debouncedIndexedRecallQuery, project.rootPath])

  function updateProviderMode(nextProviderMode: string) {
    setRuntimeError(null)
    providerApiKeyEditRevision.current += 1
    setProviderConfig((current) => ({
      ...current,
      apiKey: '',
    }))
    setProviderMode(nextProviderMode)
  }

  function updateProviderConfig(nextProviderConfig: ProviderConfig) {
    setRuntimeError(null)
    const apiKeyChanged = nextProviderConfig.apiKey !== providerConfig.apiKey
    setProviderConfig(nextProviderConfig)

    if (apiKeyChanged) {
      providerApiKeyEditRevision.current += 1
      void providerSecretStore
        .setApiKey(providerMode, nextProviderConfig.apiKey)
        .catch((error) => {
          setRuntimeError(
            `保存 Provider API Key 失败: ${
              error instanceof Error ? error.message : String(error)
            }`,
          )
        })
    }
  }

  const diffParts = useMemo(
    () =>
      rewritePatch
        ? buildDiffParts(rewritePatch.original, rewritePatch.proposed)
        : [],
    [rewritePatch],
  )
  const rewriteUnits = useMemo(
    () => (rewritePatch ? buildRewriteUnits(rewritePatch) : []),
    [rewritePatch],
  )
  const activeProvider = useMemo(
    () =>
      createModelProvider(
        providerMode,
        providerConfig,
        providerAdapterCatalog.adapters,
      ),
    [providerAdapterCatalog.adapters, providerConfig, providerMode],
  )
  const chapterSummaries = summaryStore.listSummaries()
  const volumeSummaries = volumeSummaryStore.listSummaries()
  const characterStateLogs = stateLogStore.listLogs()
  const plotThreads = plotThreadStore.listThreads()
  const activeChapterSummary = activeChapter
    ? summaryStore.getSummary(activeChapter.id)
    : undefined
  const runtimeMemoryPlan = activeChapter
    ? buildNarrativeMemoryPlan({
        chapter: activeChapter,
        projectChapters: project.chapters,
        documentText,
        codexEntries: project.codexEntries,
        chapterSummaries,
        volumeSummaries,
        characterStateLogs,
        plotThreads,
        indexedRecallResults,
        projectTitle: project.title,
        budgetChars: 900,
      })
    : {
        memories: [],
        audit: {
          budgetChars: 900,
          usedChars: 0,
          droppedCount: 0,
          layerSummaries: [],
          entries: [],
        },
      }
  const runtimeMemories = runtimeMemoryPlan.memories
  const patchValidation = rewritePatch
    ? validateRewritePatch(documentText, rewritePatch)
    : null
  const activeDraft = activeChapter
    ? draftStore.getDraft(activeChapter.id)
    : undefined
  const chapterVersions = activeChapter
    ? versionStore.listChapterVersions(activeChapter.id).slice(0, 4)
    : []
  const publishPlan = buildEditorPublishPlan({
    project,
    draftStore,
  })
  const publisherAdapters = publisherAdapterCatalog.adapters
  const providerAdapters = providerAdapterCatalog.adapters
  const selectedCharCount = selectedText.trim().length
  const documentCharCount = documentText.replace(/\s/g, '').length
  const activeChapterPath = activeChapter?.path || activeChapter?.filePath || ''
  const memoryBudgetLabel = `${runtimeMemoryPlan.audit.usedChars}/${runtimeMemoryPlan.audit.budgetChars}`

  function createAgentRuntime() {
    return createNovelAgentToolRuntime({
      project,
      draftStore,
      activeChapterId: activeChapter?.id,
      selectedText,
      chapterSummaries,
      volumeSummaries,
      characterStateLogs,
      plotThreads,
      skillCatalog,
      provider: activeProvider,
      providerAdapterCatalog,
      publisherAdapterCatalog,
      publisherReport,
      memoryBudgetChars: runtimeMemoryPlan.audit.budgetChars,
    })
  }

  async function runAgentTool(toolName: NovelAgentToolName) {
    setRuntimeError(null)
    setAgentToolRunning(toolName)

    try {
      const runtime = createAgentRuntime()
      const execution = await runtime.runTool(toolName, agentToolInputFor(toolName))
      setAgentToolExecution(execution)
      applyAgentToolResult(execution.result)
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : String(error))
    } finally {
      setAgentToolRunning(null)
    }
  }

  function agentToolInputFor(toolName: NovelAgentToolName) {
    switch (toolName) {
      case 'novel_get_project_state':
        return {
          includeChapters: true,
          includeCodex: true,
          includeProviders: true,
          includePublisher: true,
          includeSkillCatalog: true,
        }
      case 'novel_get_current_chapter':
        return {
          includeDraft: true,
        }
      case 'novel_get_memory_plan':
        return {
          chapterId: activeChapter?.id,
          budgetChars: runtimeMemoryPlan.audit.budgetChars,
        }
      case 'novel_list_story_graph_nodes':
        return {
          includeEdges: true,
          selectedOnly: true,
        }
      case 'novel_run_publisher_dry_run':
        return {
          adapterId: activePublisherAdapterId,
          limit: 1,
        }
      case 'novel_run_skill': {
        const rewriteSkill = findRewriteSkill(skillCatalog)
        return {
          skillId: rewriteSkill?.id || skillCatalog.skills[0]?.manifest.id || '',
          selectedText: selectedText || undefined,
          userInstruction: '作为 Agent 审阅提案返回，必须等待作者确认。',
        }
      }
      case 'novel_propose_rewrite_patch': {
        const original = pickAgentRewriteOriginal()
        return {
          skillId: 'agent.manual_rewrite_proposal',
          original,
          proposed: `${original}\n\n他没有立刻回答，只把指尖按在玄铁剑冰冷的剑鞘上，让那一声低鸣替自己沉默。`,
          reason: '演示 Agent 只能提出可审阅改写，不直接写入正文。',
        }
      }
      case 'novel_propose_memory_update':
        return {
          kind: 'plot_thread',
          title: '玄铁剑低鸣',
          evidence: '正文多次描写玄铁剑像有呼吸与低鸣，但原因尚未揭示。',
          confidence: 'medium',
          payload: {
            content: '玄铁剑在关键时刻发出低鸣，来源和意图尚未揭示。',
            keywords: ['玄铁剑', '低鸣'],
            relatedCharacters: ['沈微', '李长老'],
          },
        }
      default:
        return {}
    }
  }

  function pickAgentRewriteOriginal() {
    const trimmedSelection = selectedText.trim()
    if (trimmedSelection && documentText.includes(trimmedSelection)) {
      return selectedText
    }

    return (
      documentText
        .split('\n')
        .map((line) => line.trim())
        .find((line) => line && !line.startsWith('#')) || documentText.trim()
    )
  }

  function applyAgentToolResult(result: NovelAgentToolResult) {
    setAcceptedStateProposalKeys(new Set())
    setAcceptedPlotThreadProposalKeys(new Set())

    switch (result.tool) {
      case 'novel_run_skill':
        setLastResult(result.result)
        setLastSkillAudit(result.audit)
        setRewritePatch(
          result.result.type === 'rewrite_patch' ? result.result.patch : null,
        )
        break
      case 'novel_propose_rewrite_patch':
        setLastSkillAudit(null)
        setLastResult({
          type: 'rewrite_patch',
          patch: result.patch,
          auditTrail: [
            'agent:novel_propose_rewrite_patch',
            `validation:${result.validation.ok ? 'ok' : 'stale'}`,
          ],
        })
        setRewritePatch(result.patch)
        break
      case 'novel_propose_memory_update':
        setLastSkillAudit(null)
        setRewritePatch(null)
        setLastResult({
          type: 'memory_update_proposal',
          title: 'Agent 记忆提案',
          body: result.evidence,
          proposals: [result.proposal],
          auditTrail: ['agent:novel_propose_memory_update'],
        })
        break
      case 'novel_run_publisher_dry_run':
        setPublisherReport(result.report)
        break
      default:
        setLastResult(null)
        setLastSkillAudit(null)
        setRewritePatch(null)
    }
  }

  async function runSkill(skill: SkillManifest) {
    setRuntimeError(null)
    setLastResult(null)
    setRewritePatch(null)
    setLastSkillAudit(null)
    setRunningSkillId(skill.id)
    setAcceptedStateProposalKeys(new Set())
    setAcceptedPlotThreadProposalKeys(new Set())

    try {
      const preview = previewSkillRun({
        documentText,
        selectedText,
        chapterTitle: activeChapter?.title || project.title,
        memories: runtimeMemories,
        skill,
        provider: activeProvider,
      })
      setLastSkillAudit(preview.audit)
      const providerConfigError = validateProviderConfig(
        providerMode,
        providerConfig,
        providerAdapters,
      )
      if (providerConfigError) {
        throw new Error(providerConfigError)
      }

      const result = await runSkillWithProvider(
        skill,
        preview.context,
        activeProvider,
      )

      setLastResult(result)
      setRewritePatch(result.type === 'rewrite_patch' ? result.patch : null)
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : String(error))
    } finally {
      setRunningSkillId(null)
    }
  }

  function previewSkill(skill: SkillManifest) {
    setRuntimeError(null)
    setLastResult(null)
    setRewritePatch(null)
    setRunningSkillId(null)
    setAcceptedStateProposalKeys(new Set())
    setAcceptedPlotThreadProposalKeys(new Set())

    const preview = previewSkillRun({
      documentText,
      selectedText,
      chapterTitle: activeChapter?.title || project.title,
      memories: runtimeMemories,
      skill,
      provider: activeProvider,
    })

    setLastSkillAudit(preview.audit)
  }

  function runAiReview() {
    const rewriteSkill = findRewriteSkill(skillCatalog)
    if (!rewriteSkill) return
    void runSkill(rewriteSkill)
  }

  async function acceptPatch() {
    if (!rewritePatch || !activeChapter) return
    const nextDocumentText = applyRewritePatch(documentText, rewritePatch)

    const version = versionStore.createSnapshot({
      chapterId: activeChapter.id,
      contentSnapshot: documentText,
      source: 'ai',
      operation: 'rewrite_accept',
      note: '接受 AI 改写前自动快照',
      modelId: activeProvider.id,
      skillId: rewritePatch.skillId,
    })

    try {
      await saveVersionSnapshot(version)
      setVersionRevision((revision) => revision + 1)
      updateDocumentText(nextDocumentText)
      setRewritePatch(null)
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : String(error))
    }
  }

  async function acceptRewriteUnit(unitId: string) {
    if (!rewritePatch || !activeChapter) return
    const nextDocumentText = applyRewriteUnit(documentText, rewritePatch, unitId)

    const version = versionStore.createSnapshot({
      chapterId: activeChapter.id,
      contentSnapshot: documentText,
      source: 'ai',
      operation: 'rewrite_accept',
      note: '接受 AI 单句改写前自动快照',
      modelId: activeProvider.id,
      skillId: rewritePatch.skillId,
    })

    try {
      await saveVersionSnapshot(version)
      setVersionRevision((revision) => revision + 1)
      updateDocumentText(nextDocumentText)
      const remainingPatch = acceptRewriteUnitInPatch(rewritePatch, unitId)
      const remainingUnits = buildRewriteUnits(remainingPatch)
      setRewritePatch(remainingUnits.length > 0 ? remainingPatch : null)
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : String(error))
    }
  }

  function rejectRewriteUnit(unitId: string) {
    if (!rewritePatch) return

    try {
      const remainingPatch = rejectRewriteUnitInPatch(rewritePatch, unitId)
      const remainingUnits = buildRewriteUnits(remainingPatch)
      setRewritePatch(remainingUnits.length > 0 ? remainingPatch : null)
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : String(error))
    }
  }

  function updateDocumentText(nextDocumentText: string) {
    if (activeChapter) {
      draftStore.updateDraft(activeChapter.id, nextDocumentText)
      setDraftRevision((revision) => revision + 1)
    }
    setDocumentText(nextDocumentText)
    setPublisherReport(null)
    setAgentToolExecution(null)
  }

  async function saveActiveChapter() {
    if (!activeChapter) return
    setRuntimeError(null)
    setSavingChapterId(activeChapter.id)

    try {
      await projectPersistence.saveChapter(
        activeChapter.filePath || activeChapter.path,
        documentText,
      )
      draftStore.saveDraft(activeChapter.id)
      setDraftRevision((revision) => revision + 1)
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : String(error))
    } finally {
      setSavingChapterId(null)
    }
  }

  async function runPublisherPreview(adapterId = activePublisherAdapterId) {
    setRuntimeError(null)
    setPublisherReport(null)
    setPublisherRunning(true)

    try {
      const report = await runEditorPublisherDryRun({
        adapterId,
        project,
        draftStore,
        limit: 1,
        adapters: publisherAdapters,
      })
      setActivePublisherAdapterId(adapterId)
      setPublisherReport(report)
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : String(error))
    } finally {
      setPublisherRunning(false)
    }
  }

  function changePublisherAdapter(adapterId: string) {
    setActivePublisherAdapterId(adapterId)
    setPublisherReport(null)
  }

  function confirmStateProposal(proposal: CharacterStateChangeProposal) {
    if (!activeChapter) return

    const proposalKey = stateProposalKey(proposal)
    const log = stateLogStore.confirmProposal({
      proposal,
      chapterId: activeChapter.id,
      chapterTitle: activeChapter.title,
      sourceSkillId: lastSkillAudit?.skill.id || 'agent.proposed_memory_update',
    })
    setAcceptedStateProposalKeys((current) => new Set(current).add(proposalKey))
    setStateLogRevision((revision) => revision + 1)

    if (project.rootPath) {
      void stateLogPersistence
        .saveCharacterStateLog(project.rootPath, log)
        .catch((error: unknown) => {
          setRuntimeError(error instanceof Error ? error.message : String(error))
        })
    }
  }

  function confirmPlotThreadProposal(proposal: PlotThreadChangeProposal) {
    if (!activeChapter) return

    const proposalKey = plotThreadProposalKey(proposal)
    const plotThreadProposal: PlotThreadProposal = {
      title: proposal.title,
      content: proposal.content,
      plantedChapterId: activeChapter.id,
      keywords: proposal.keywords,
      relatedCharacters: proposal.relatedCharacters,
      evidence: proposal.evidence,
    }

    const thread = plotThreadStore.confirmProposal({
      proposal: plotThreadProposal,
      plantedChapter: activeChapter,
      sourceSkillId: lastSkillAudit?.skill.id || 'agent.proposed_memory_update',
    })
    setAcceptedPlotThreadProposalKeys((current) =>
      new Set(current).add(proposalKey),
    )
    setPlotThreadRevision((revision) => revision + 1)

    if (project.rootPath) {
      void plotThreadPersistence
        .savePlotThread(project.rootPath, thread)
        .catch((error: unknown) => {
          setRuntimeError(error instanceof Error ? error.message : String(error))
        })
    }
  }

  async function createManualSnapshot() {
    if (!activeChapter) return
    const version = versionStore.createSnapshot({
      chapterId: activeChapter.id,
      contentSnapshot: documentText,
      source: 'manual',
      operation: 'snapshot',
      note: '手动快照',
    })

    try {
      await saveVersionSnapshot(version)
      setVersionRevision((revision) => revision + 1)
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : String(error))
    }
  }

  async function restoreVersion(version: ChapterVersion) {
    if (!activeChapter) return
    setRuntimeError(null)

    const beforeRestoreVersion = versionStore.createSnapshot({
      chapterId: activeChapter.id,
      contentSnapshot: documentText,
      source: 'manual',
      operation: 'snapshot',
      note: `恢复 ${new Date(version.createdAt).toLocaleString()} 快照前自动保存当前稿`,
    })

    try {
      await saveVersionSnapshot(beforeRestoreVersion)
      setVersionRevision((revision) => revision + 1)
      updateDocumentText(version.contentSnapshot)
      setRewritePatch(null)
      setLastResult(null)
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : String(error))
    }
  }

  async function saveVersionSnapshot(version: ChapterVersion) {
    if (!project.rootPath) return

    await versionPersistence.saveChapterVersion(project.rootPath, version)
  }

  function saveGraphSnapshot(snapshot: StoryGraphSnapshot) {
    setGraphSnapshot(snapshot)

    if (!project.rootPath) return

    void graphSnapshotPersistence
      .saveGraphSnapshot(project.rootPath, snapshot)
      .catch((error: unknown) => {
        setRuntimeError(error instanceof Error ? error.message : String(error))
      })
  }

  async function loadOptionalGraphSnapshot(rootPath: string) {
    try {
      return await graphSnapshotPersistence.loadGraphSnapshot(rootPath)
    } catch (error) {
      setRuntimeError(
        `图谱快照读取失败，已忽略: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )
      return null
    }
  }

  async function generateActiveSummary() {
    if (!activeChapter) return

    setRuntimeError(null)

    const summary = await generateSummaryWithProvider(activeChapter)
    const nextChapterSummaries = [
      ...chapterSummaries.filter(
        (chapterSummary) => chapterSummary.chapterId !== summary.chapterId,
      ),
      summary,
    ]
    refreshVolumeSummaryForChapter(activeChapter, nextChapterSummaries)
    setSummaryRevision((revision) => revision + 1)

    if (!project.rootPath) return

    try {
      await summaryPersistence.saveChapterSummary(project.rootPath, summary)
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : String(error))
    }
  }

  async function generateSummaryWithProvider(chapter: ProjectChapter) {
    const summarySkill = findChapterSummarySkill(skillCatalog)

    if (!summarySkill) {
      return summaryStore.upsertGeneratedSummary({
        chapter,
        content: documentText,
        codexEntries: project.codexEntries,
      })
    }

    try {
      const providerConfigError = validateProviderConfig(
        providerMode,
        providerConfig,
        providerAdapters,
      )
      if (providerConfigError) {
        throw new Error(providerConfigError)
      }

      const preview = previewSkillRun({
        documentText,
        selectedText: '',
        chapterTitle: chapter.title,
        memories: runtimeMemories,
        skill: summarySkill,
        provider: activeProvider,
      })
      setLastSkillAudit(preview.audit)

      const result = await runSkillWithProvider(
        summarySkill,
        preview.context,
        activeProvider,
      )
      setLastResult(result)

      if (result.type !== 'chapter_summary') {
        throw new Error(
          `摘要 Skill 返回了不支持的结果类型: ${result.type}`,
        )
      }

      return summaryStore.upsertModelSummary({
        chapter,
        content: documentText,
        summary: result.summary,
        keyEvents: result.keyEvents,
        charactersInvolved: result.charactersInvolved,
      })
    } catch (error) {
      setRuntimeError(
        `AI 摘要失败，已使用本地摘要: ${
          error instanceof Error ? error.message : String(error)
        }`,
      )

      return summaryStore.upsertGeneratedSummary({
        chapter,
        content: documentText,
        codexEntries: project.codexEntries,
      })
    }
  }

  async function openProject() {
    setRuntimeError(null)

    try {
      const loadedProject = await pickAndLoadTauriProject()

      if (!loadedProject) {
        return
      }

      const [
        loadedSummaries,
        loadedVolumeSummaries,
        loadedVersions,
        loadedStateLogs,
        loadedPlotThreads,
        loadedGraphSnapshot,
      ] = loadedProject.rootPath
        ? await Promise.all([
            summaryPersistence.loadChapterSummaries(loadedProject.rootPath),
            volumeSummaryPersistence.loadVolumeSummaries(loadedProject.rootPath),
            versionPersistence.loadChapterVersions(loadedProject.rootPath),
            stateLogPersistence.loadCharacterStateLogs(loadedProject.rootPath),
            plotThreadPersistence.loadPlotThreads(loadedProject.rootPath),
            loadOptionalGraphSnapshot(loadedProject.rootPath),
          ])
        : [[], [], [], [], [], null]
      const initialVolumeSummaries =
        loadedVolumeSummaries.length > 0
          ? loadedVolumeSummaries
          : buildLocalVolumeSummaries({
              projectChapters: loadedProject.chapters,
              chapterSummaries: loadedSummaries,
            })

      setWorkspace(
        createWorkspaceState(
          loadedProject,
          loadedSummaries,
          loadedVersions,
          loadedStateLogs,
          loadedPlotThreads,
          initialVolumeSummaries,
        ),
      )
      setSkillCatalog(loadSkillCatalog())
      setPublisherAdapterCatalog({
        adapters: listEditorPublisherAdapters(),
        errors: [],
      })
      setSelectedText('')
      setLastResult(null)
      setLastSkillAudit(null)
      setRewritePatch(null)
      setPublisherReport(null)
      setGraphSnapshot(loadedGraphSnapshot)
      setDraftRevision((revision) => revision + 1)
      setSummaryRevision((revision) => revision + 1)
      setVolumeSummaryRevision((revision) => revision + 1)
      setVersionRevision((revision) => revision + 1)
      setStateLogRevision((revision) => revision + 1)
      setPlotThreadRevision((revision) => revision + 1)
    } catch (error) {
      setRuntimeError(error instanceof Error ? error.message : String(error))
    }
  }

  function refreshVolumeSummaryForChapter(
    chapter: typeof activeChapter,
    summaries: ChapterSummary[],
  ) {
    if (!chapter) return

    const volumeId = volumeIdForChapter(chapter)
    const volumeChapterSummaries = chapterSummariesForVolume({
      volumeId,
      projectChapters: project.chapters,
      chapterSummaries: summaries,
    })

    if (volumeChapterSummaries.length === 0) return

    const volumeSummary = volumeSummaryStore.upsertGeneratedSummary({
      volumeId,
      volumeTitle: volumeId,
      chapterSummaries: volumeChapterSummaries,
    })
    setVolumeSummaryRevision((revision) => revision + 1)

    if (project.rootPath) {
      void volumeSummaryPersistence
        .saveVolumeSummary(project.rootPath, volumeSummary)
        .catch((error: unknown) => {
          setRuntimeError(error instanceof Error ? error.message : String(error))
        })
    }
  }

  return (
    <TooltipProvider>
      <main className="workspace">
        <aside className="sidebar">
          <div className="activity-rail" aria-label="Primary">
            <div className="activity-brand">
              <BookOpen aria-hidden="true" />
            </div>

            <nav className="activity-nav" aria-label="Workspace">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label="写作"
                    className="active"
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <PenLine aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">写作</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label="设定库"
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <LibraryBig aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">设定库</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label="四层记忆"
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Boxes aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">四层记忆</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label="Skills"
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <Plug aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">Skills</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label="发布"
                    size="icon"
                    type="button"
                    variant="ghost"
                  >
                    <UploadCloud aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">发布</TooltipContent>
              </Tooltip>
            </nav>
          </div>

          <div className="explorer-pane">
            <div className="brand">
              <div className="min-w-0">
                <span>EXPLORER</span>
                <strong>{project.title}</strong>
              </div>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    aria-label="打开项目"
                    className="brand-open"
                    onClick={() => void openProject()}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <FolderOpen aria-hidden="true" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom">打开项目</TooltipContent>
              </Tooltip>
            </div>

            <Separator />

            <ScrollArea className="chapter-scroll">
              <section className="chapter-list" aria-label="Chapters">
                <div className="section-title">
                  <span>manuscript</span>
                  <GitBranch aria-hidden="true" />
                </div>
                {project.chapters.map((chapter) => (
                  <Button
                    className={
                      chapter.id === activeChapter?.id
                        ? 'chapter active'
                        : 'chapter'
                    }
                    key={chapter.title}
                    onClick={() => setActiveChapterId(chapter.id)}
                    type="button"
                    variant="ghost"
                  >
                    <span>{chapter.title}</span>
                    <small>{chapter.status}</small>
                  </Button>
                ))}
              </section>
            </ScrollArea>
          </div>
        </aside>

        <section className="editor-shell">
          <header className="topbar">
            <div className="editor-tabs" aria-label="Open editors">
              <button className="editor-tab active" type="button">
                <FileText aria-hidden="true" />
                <span>{activeChapter?.title || project.title}</span>
                <X aria-hidden="true" />
              </button>
              <div className="editor-tab-spacer" />
            </div>
            <div className="top-actions">
              <Button
                disabled={
                  activeDraft?.status !== 'dirty' ||
                  savingChapterId === activeChapter?.id
                }
                onClick={() => void saveActiveChapter()}
                type="button"
                variant="secondary"
              >
                <Save data-icon="inline-start" aria-hidden="true" />
                {savingChapterId === activeChapter?.id ? '保存中' : '保存'}
              </Button>
              <Button
                onClick={() => void createManualSnapshot()}
                type="button"
                variant="secondary"
              >
                <FileClock data-icon="inline-start" aria-hidden="true" />
                快照
              </Button>
              <Button
                onClick={() => void generateActiveSummary()}
                type="button"
                variant="secondary"
              >
                <FileText data-icon="inline-start" aria-hidden="true" />
                摘要
              </Button>
              <Button onClick={runAiReview} type="button">
                <Send data-icon="inline-start" aria-hidden="true" />
                AI 审阅
              </Button>
            </div>
          </header>

          <MarkdownEditor
            initialDoc={documentText}
            onChange={updateDocumentText}
            onSelectionChange={setSelectedText}
          />

          <footer className="statusbar" aria-label="Workspace status">
            <div className="statusbar-group">
              <span className="statusbar-item statusbar-primary">
                <GitBranch aria-hidden="true" />
                main
              </span>
              <span className="statusbar-item">
                <Braces aria-hidden="true" />
                Markdown
              </span>
              <span
                className="statusbar-item statusbar-source"
                title={`真相源: ${project.sourceOfTruth}`}
              >
                文件源
              </span>
              <span className="statusbar-item statusbar-path">
                {activeChapterPath}
              </span>
            </div>
            <div className="statusbar-group statusbar-right">
              <span className="statusbar-item">{documentCharCount} 字</span>
              <span className="statusbar-item">
                选区 {selectedCharCount} 字
              </span>
              <span className="statusbar-item">记忆 {memoryBudgetLabel}</span>
              <span className="statusbar-item">{activeProvider.label}</span>
              <Badge
                className={`save-state ${activeDraft?.status || 'clean'}`}
                variant="secondary"
              >
                {savingChapterId === activeChapter?.id
                  ? '保存中'
                  : activeDraft?.status === 'dirty'
                    ? '未保存'
                    : activeDraft?.status === 'saved'
                      ? '已保存'
                      : '已同步'}
              </Badge>
            </div>
          </footer>
        </section>

        <NarrativeInspector
          activeChapter={activeChapter}
          projectTitle={project.title}
          initialGraphSnapshot={graphSnapshot}
          onGraphSnapshotChange={saveGraphSnapshot}
          codexEntries={project.codexEntries}
          runtimeMemories={runtimeMemories}
          runtimeMemoryPlan={runtimeMemoryPlan}
          activeChapterSummary={activeChapterSummary}
          volumeSummaries={volumeSummaries}
          chapterVersions={chapterVersions}
          characterStateLogs={characterStateLogs}
          plotThreads={plotThreads}
          skillCatalog={skillCatalog}
          agentToolExecution={agentToolExecution}
          agentToolRunning={agentToolRunning}
          onRunAgentTool={runAgentTool}
          runningSkillId={runningSkillId}
          lastSkillAudit={lastSkillAudit}
          runtimeError={runtimeError}
          lastResult={lastResult}
          rewritePatch={rewritePatch}
          diffParts={diffParts}
          rewriteUnits={rewriteUnits}
          patchValidation={patchValidation}
          acceptedStateProposalKeys={acceptedStateProposalKeys}
          acceptedPlotThreadProposalKeys={acceptedPlotThreadProposalKeys}
          publishPlan={publishPlan}
          publisherAdapters={publisherAdapters}
          publisherAdapterErrors={publisherAdapterCatalog.errors}
          activePublisherAdapterId={activePublisherAdapterId}
          publisherRunning={publisherRunning}
          publisherReport={publisherReport}
          providerMode={providerMode}
          providerConfig={providerConfig}
          providerAdapters={providerAdapters}
          providerAdapterErrors={providerAdapterCatalog.errors}
          onRunSkill={runSkill}
          onPreviewSkill={previewSkill}
          onAcceptPatch={() => void acceptPatch()}
          onAcceptRewriteUnit={(unitId) => void acceptRewriteUnit(unitId)}
          onRejectRewriteUnit={rejectRewriteUnit}
          onRejectPatch={() => setRewritePatch(null)}
          onConfirmStateProposal={confirmStateProposal}
          onConfirmPlotThreadProposal={confirmPlotThreadProposal}
          onRestoreVersion={(version) => void restoreVersion(version)}
          onRunPublisherPreview={(adapterId) =>
            void runPublisherPreview(adapterId)
          }
          onPublisherAdapterChange={changePublisherAdapter}
          onProviderModeChange={updateProviderMode}
          onProviderConfigChange={updateProviderConfig}
        />
      </main>
    </TooltipProvider>
  )
}

function buildIndexedRecallQuery(documentText: string, codexEntries: CodexEntry[]) {
  const codexTerms = codexEntries.flatMap((entry) =>
    [entry.name, ...entry.keywords].filter(
      (keyword) => keyword && documentText.includes(keyword),
    ),
  )
  const proseTerms = documentText.match(/[\u4e00-\u9fff]{3,8}/g) || []
  const terms = uniqueStrings([...codexTerms, ...proseTerms])
    .filter((term) => term.length >= 3)
    .slice(0, 8)

  return terms.join(' ')
}

function mapChapterSearchResults(
  results: ChapterSearchResult[],
): IndexedRecallResult[] {
  return results.map((result) => ({
    chapterId: result.chapter_id,
    chapterTitle: result.chapter_title,
    sourcePath: result.file_path,
    snippet: result.snippet,
    score: result.score,
    source: result.source,
  }))
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

export default App
