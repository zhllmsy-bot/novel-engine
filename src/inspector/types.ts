import type { ProviderConfig } from '@/ai/providerRuntime'
import type { ProviderAdapterManifest } from '@/ai/providerManifest'
import type { NovelAgentToolExecution } from '@/agent-tools/novelAgentRuntime'
import type { NovelAgentToolName } from '@/agent-tools/novelAgentTools'
import type { DiffPart, PatchValidation } from '@/diff/safeRewrite'
import type { StoryGraphSnapshot } from '@/inspector/storyGraphSnapshot'
import type { ChapterSummary } from '@/memory/chapterSummaryStore'
import type { CharacterStateLog } from '@/memory/characterStateLogStore'
import type { NarrativeMemoryPlan } from '@/memory/memoryContextBuilder'
import type { PlotThread } from '@/memory/plotThreadStore'
import type { CodexEntry, ProjectChapter } from '@/project/projectTypes'
import type { VolumeSummary } from '@/memory/volumeSummaryStore'
import type {
  EditorPublishPlan,
  EditorPublishReport,
  EditorPublisherAdapterInfo,
} from '@/publisher/editorPublisher'
import type { SkillCatalog } from '@/skills/skillCatalog'
import type { SkillRunAudit } from '@/skills/skillRuntime'
import type {
  CharacterStateChangeProposal,
  NarrativeMemory,
  PlotThreadChangeProposal,
  RewritePatch,
  SkillManifest,
  SkillRunResult,
} from '@/types/domain'
import type { ChapterVersion } from '@/versioning/chapterVersionStore'

export type MemoryPanelProps = {
  activeChapter?: ProjectChapter
  codexEntries: CodexEntry[]
  runtimeMemories: NarrativeMemory[]
  runtimeMemoryPlan: NarrativeMemoryPlan
  activeChapterSummary?: ChapterSummary
  volumeSummaries: VolumeSummary[]
  chapterVersions: ChapterVersion[]
  characterStateLogs: CharacterStateLog[]
  plotThreads: PlotThread[]
  onRestoreVersion: (version: ChapterVersion) => void | Promise<void>
}

export type StoryGraphPanelProps = MemoryPanelProps & {
  projectTitle?: string
  initialGraphSnapshot?: StoryGraphSnapshot | null
  onGraphSnapshotChange?: (snapshot: StoryGraphSnapshot) => void | Promise<void>
  lastSkillAudit: SkillRunAudit | null
  lastResult: SkillRunResult | null
  publishPlan: EditorPublishPlan
  publisherReport: EditorPublishReport | null
}

export type SkillsPanelProps = {
  skillCatalog: SkillCatalog
  agentToolExecution: NovelAgentToolExecution | null
  agentToolRunning: NovelAgentToolName | null
  onRunAgentTool: (toolName: NovelAgentToolName) => void | Promise<void>
  runningSkillId: string | null
  lastSkillAudit: SkillRunAudit | null
  runtimeError: string | null
  lastResult: SkillRunResult | null
  rewritePatch: RewritePatch | null
  diffParts: DiffPart[]
  patchValidation: PatchValidation | null
  acceptedStateProposalKeys: Set<string>
  acceptedPlotThreadProposalKeys: Set<string>
  onRunSkill: (skill: SkillManifest) => void | Promise<void>
  onPreviewSkill: (skill: SkillManifest) => void
  onConfirmStateProposal: (proposal: CharacterStateChangeProposal) => void
  onConfirmPlotThreadProposal: (proposal: PlotThreadChangeProposal) => void
  onAcceptPatch: () => void | Promise<void>
  onRejectPatch: () => void
}

export type PublishPanelProps = {
  publisherAdapters: EditorPublisherAdapterInfo[]
  publisherAdapterErrors: string[]
  activePublisherAdapterId: string
  publishPlan: EditorPublishPlan
  publisherRunning: boolean
  publisherReport: EditorPublishReport | null
  onRunPublisherPreview: (adapterId?: string) => void | Promise<void>
  onPublisherAdapterChange: (adapterId: string) => void
}

export type ProviderPanelProps = {
  providerMode: string
  providerConfig: ProviderConfig
  providerAdapters: ProviderAdapterManifest[]
  providerAdapterErrors: string[]
  onProviderModeChange: (mode: string) => void
  onProviderConfigChange: (config: ProviderConfig) => void
}

export type NarrativeInspectorProps = MemoryPanelProps &
  SkillsPanelProps &
  PublishPanelProps &
  ProviderPanelProps & {
    projectTitle?: string
    initialGraphSnapshot?: StoryGraphSnapshot | null
    onGraphSnapshotChange?: (
      snapshot: StoryGraphSnapshot,
    ) => void | Promise<void>
  }
