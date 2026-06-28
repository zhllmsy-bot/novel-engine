import type { MemorySourceFamily } from './memorySourceFamilies'

export type ChapterStatus = '已摘要' | '已快照' | '编辑中'

export type ChapterListItem = {
  id: string
  title: string
  status: ChapterStatus
}

export type MemoryLayer = 'L0 事实' | 'L1 剧情' | 'L2 风格' | 'L3 意图'

export type NarrativeMemory = {
  layer: MemoryLayer
  body: string
  source: string
}

export type SkillOutputMode =
  | 'report'
  | 'rewrite_patch'
  | 'memory_update_proposal'
  | 'export_artifact'

export type SkillRiskLevel = 'low' | 'medium' | 'high'

export type SkillModelProfile = 'fast' | 'balanced' | 'deep'

export type SkillManifest = {
  id: string
  name: string
  version: string
  category: string
  description: string
  riskLevel: SkillRiskLevel
  outputMode: SkillOutputMode
  outputSchema: string
  requiresReview: boolean
  prompt?: string
  input?: {
    required: string[]
    optional: string[]
  }
  retrieval?: {
    includeRecentChapters?: number
    includeCharacters?: 'auto' | 'none'
    includeWorldbuilding?: 'auto' | 'none'
    includeRecall?: 'auto' | 'none'
    sourceFamilies?: MemorySourceFamily[]
  }
  model?: {
    profile?: SkillModelProfile
    temperature?: number
  }
}

export type RewritePatch = {
  original: string
  proposed: string
  skillId: string
  requiresSnapshot: true
}

export type CharacterStateChangeProposal = {
  kind: 'character_state'
  characterName: string
  field: string
  from?: string
  to: string
  reason: string
  evidence?: string
  confidence?: 'low' | 'medium' | 'high'
}

export type PlotThreadChangeProposal = {
  kind: 'plot_thread'
  title: string
  content: string
  keywords: string[]
  relatedCharacters?: string[]
  evidence?: string
  confidence?: 'low' | 'medium' | 'high'
}

export type MemoryUpdateProposal =
  | CharacterStateChangeProposal
  | PlotThreadChangeProposal

export type SkillContext = {
  selectedText: string
  nearbyText: string
  chapterTitle: string
  chapterSummary?: string
  memories: NarrativeMemory[]
  memoryFilterAudit?: {
    beforeCount: number
    afterCount: number
    droppedCount: number
    dropped: {
      layer: MemoryLayer
      source: string
      reason:
        | 'recent_chapters_disabled'
        | 'recall_disabled'
        | 'characters_disabled'
        | 'worldbuilding_disabled'
        | 'source_family_disabled'
    }[]
  }
  userInstruction?: string
}

export type SkillRunRequest = {
  skill: SkillManifest
  context: SkillContext
}

export type SkillRunResult =
  | {
      type: 'rewrite_patch'
      patch: RewritePatch
      auditTrail: string[]
    }
  | {
      type: 'report'
      title: string
      body: string
      auditTrail: string[]
    }
  | {
      type: 'memory_update_proposal'
      title: string
      body: string
      proposals: MemoryUpdateProposal[]
      auditTrail: string[]
    }
  | {
      type: 'export_artifact'
      title: string
      body: string
      auditTrail: string[]
    }
