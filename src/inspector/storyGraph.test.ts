import { describe, expect, it } from 'vitest'

import {
  buildStoryGraph,
  filterStoryGraphByView,
  getStoryGraphNodeContext,
  summarizeStoryGraph,
} from './storyGraph'
import type { NarrativeMemoryPlan } from '@/memory/memoryContextBuilder'
import type { PlotThread } from '@/memory/plotThreadStore'
import type { CodexEntry, ProjectChapter } from '@/project/projectTypes'
import type {
  EditorPublishPlan,
  EditorPublishReport,
} from '@/publisher/editorPublisher'
import type { SkillRunAudit } from '@/skills/skillRuntime'

const chapter: ProjectChapter = {
  id: 'chapter-001',
  title: '第001章 山门雨',
  status: '编辑中',
  path: 'manuscript/volume-001/chapter-001.md',
  order: 1,
  content: '沈微见到了李长老。',
  wordCount: 10,
}

const codexEntry: CodexEntry = {
  id: 'li-zhanglao',
  name: '李长老',
  type: 'character',
  path: 'codex/characters/li-zhanglao.md',
  keywords: ['李长老'],
  body: '玄天宗戒律堂长老。',
  frontmatter: {},
  currentState: {},
}

const plotThread: PlotThread = {
  id: 'plot:chapter-001:玄铁剑:1',
  title: '玄铁剑鸣',
  content: '玄铁剑第一次发出声音。',
  plantedChapterId: chapter.id,
  plantedChapterTitle: chapter.title,
  keywords: ['玄铁剑'],
  status: 'open',
  confirmed: true,
  sourceSkillId: 'xuanhuan.foreshadowing_thread',
  confirmedAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const memoryPlan: NarrativeMemoryPlan = {
  memories: [
    {
      layer: 'L2 风格',
      body: '当前章原文',
      source: 'manuscript/volume-001/chapter-001.md',
    },
    {
      layer: 'L0 事实',
      body: '李长老设定',
      source: 'codex/characters/li-zhanglao.md',
    },
    {
      layer: 'L3 意图',
      body: '召回玄铁剑',
      source: 'recall:plot_thread:plot:chapter-001:玄铁剑:1',
    },
    {
      layer: 'L1 剧情',
      body: '山门雨夜，沈微获得玄铁剑。',
      source: 'chapter_summary:chapter-001',
    },
  ],
  audit: {
    budgetChars: 900,
    usedChars: 100,
    droppedCount: 0,
    layerSummaries: [],
    entries: [],
  },
}

const skillAudit: SkillRunAudit = {
  skill: {
    id: 'xuanhuan.dialogue_polish',
    name: '玄幻对白润色',
    version: '1.0.0',
    outputMode: 'rewrite_patch',
    riskLevel: 'medium',
    requiresReview: true,
  },
  provider: {
    id: 'mock',
    label: 'Local Mock Provider',
  },
  prompt: '润色当前对白。',
  input: {
    required: ['nearby_text'],
    optional: ['recent_style', 'character_cards'],
    available: ['nearby_text', 'recent_style', 'character_cards'],
    missingRequired: [],
  },
  retrieval: {
    includeRecentChapters: 3,
    includeCharacters: 'auto',
  },
  model: {
    profile: 'balanced',
    temperature: 0.4,
  },
  context: {
    chapterTitle: chapter.title,
    selectedChars: 0,
    nearbyChars: chapter.content.length,
    memoryCount: 2,
  },
  memorySources: [
    'L2 风格:manuscript/volume-001/chapter-001.md',
    'L0 事实:codex/characters/li-zhanglao.md',
  ],
  memoryLayerSummaries: [
    {
      layer: 'L2 风格',
      count: 1,
      chars: '沈微第一次听见玄铁剑，是在玄天宗山门外的雨夜。'.length,
      sources: ['manuscript/volume-001/chapter-001.md'],
    },
    {
      layer: 'L0 事实',
      count: 1,
      chars: '李长老，玄天宗戒律堂长老。'.length,
      sources: ['codex/characters/li-zhanglao.md'],
    },
  ],
  memoryFilter: {
    beforeCount: 2,
    afterCount: 2,
    droppedCount: 0,
    dropped: [],
  },
}

const publishPlan: EditorPublishPlan = {
  scanned: 1,
  skipped: 0,
  pending: [
    {
      id: chapter.id,
      number: chapter.order,
      title: chapter.title,
      content: chapter.content,
      sourcePath: chapter.path,
      wordCount: chapter.wordCount,
    },
  ],
}

const publisherReport: EditorPublishReport = {
  adapterId: 'dry-run',
  scanned: 1,
  skipped: 0,
  attempted: 1,
  succeeded: 1,
  failed: 0,
  results: [
    {
      chapter: publishPlan.pending[0],
      result: {
        status: 'success',
        message: 'Dry-run accepted chapter.',
        remoteId: 'dry-run-001',
      },
    },
  ],
}

describe('story graph', () => {
  it('builds a provenance graph from current chapter and memory sources', () => {
    const graph = buildStoryGraph({
      activeChapter: chapter,
      runtimeMemoryPlan: memoryPlan,
      codexEntries: [codexEntry],
      plotThreads: [plotThread],
    })

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'chapter:chapter-001',
          kind: 'chapter',
          label: '第001章 山门雨',
        }),
        expect.objectContaining({
          kind: 'memory',
          label: 'L0 事实',
          detail: 'codex/characters/li-zhanglao.md',
        }),
        expect.objectContaining({
          kind: 'codex',
          label: '李长老',
        }),
        expect.objectContaining({
          kind: 'plot_thread',
          label: '玄铁剑鸣',
        }),
      ]),
    )

    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: expect.stringContaining('memory:'),
          to: 'chapter:chapter-001',
          label: '注入',
        }),
        expect.objectContaining({
          from: 'codex:li-zhanglao',
          to: 'chapter:chapter-001',
          label: '事实',
        }),
        expect.objectContaining({
          from: 'plot:plot:chapter-001:玄铁剑:1',
          to: 'chapter:chapter-001',
          label: '召回',
        }),
      ]),
    )
  })

  it('describes upstream and downstream context for a selected node', () => {
    const graph = buildStoryGraph({
      activeChapter: chapter,
      runtimeMemoryPlan: memoryPlan,
      codexEntries: [codexEntry],
      plotThreads: [plotThread],
    })

    const chapterContext = getStoryGraphNodeContext(graph, 'chapter:chapter-001')

    expect(chapterContext?.incoming).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          edge: expect.objectContaining({ label: '注入' }),
          node: expect.objectContaining({ kind: 'memory', label: 'L2 风格' }),
        }),
        expect.objectContaining({
          edge: expect.objectContaining({ label: '事实' }),
          node: expect.objectContaining({ kind: 'codex', label: '李长老' }),
        }),
        expect.objectContaining({
          edge: expect.objectContaining({ label: '召回' }),
          node: expect.objectContaining({
            kind: 'plot_thread',
            label: '玄铁剑鸣',
          }),
        }),
      ]),
    )
    expect(chapterContext?.outgoing).toHaveLength(0)

    const memoryNode = graph.nodes.find(
      (node) => node.kind === 'memory' && node.layer === 'L0 事实',
    )
    const memoryContext = memoryNode
      ? getStoryGraphNodeContext(graph, memoryNode.id)
      : undefined

    expect(memoryContext?.incoming).toHaveLength(0)
    expect(memoryContext?.outgoing).toEqual([
      expect.objectContaining({
        edge: expect.objectContaining({ label: '注入' }),
        node: expect.objectContaining({ id: 'chapter:chapter-001' }),
      }),
    ])
  })

  it('returns undefined for an unknown node', () => {
    const graph = buildStoryGraph({
      activeChapter: chapter,
      runtimeMemoryPlan: memoryPlan,
      codexEntries: [codexEntry],
      plotThreads: [plotThread],
    })

    expect(getStoryGraphNodeContext(graph, 'missing')).toBeUndefined()
  })

  it('adds a Skill run node with memory inputs and chapter output', () => {
    const graph = buildStoryGraph({
      activeChapter: chapter,
      runtimeMemoryPlan: memoryPlan,
      codexEntries: [codexEntry],
      plotThreads: [plotThread],
      lastSkillAudit: skillAudit,
      lastResult: {
        type: 'rewrite_patch',
        patch: {
          original: chapter.content,
          proposed: `${chapter.content}\n李长老没有再说话。`,
          skillId: skillAudit.skill.id,
          requiresSnapshot: true,
        },
        auditTrail: ['snapshot required'],
      },
    })

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'skill:xuanhuan.dialogue_polish',
          kind: 'skill_run',
          label: '玄幻对白润色',
          detail: expect.stringContaining('rewrite_patch'),
        }),
      ]),
    )
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          to: 'skill:xuanhuan.dialogue_polish',
          label: '输入',
        }),
        expect.objectContaining({
          from: 'skill:xuanhuan.dialogue_polish',
          to: 'chapter:chapter-001',
          label: '待审',
        }),
      ]),
    )

    const skillContext = getStoryGraphNodeContext(
      graph,
      'skill:xuanhuan.dialogue_polish',
    )
    expect(skillContext?.incoming).toHaveLength(2)
    expect(skillContext?.outgoing).toEqual([
      expect.objectContaining({
        edge: expect.objectContaining({ label: '待审' }),
        node: expect.objectContaining({ id: 'chapter:chapter-001' }),
      }),
    ])
  })

  it('filters a view while keeping provenance edges around focused nodes', () => {
    const graph = buildStoryGraph({
      activeChapter: chapter,
      runtimeMemoryPlan: memoryPlan,
      codexEntries: [codexEntry],
      plotThreads: [plotThread],
      lastSkillAudit: skillAudit,
    })

    const skillGraph = filterStoryGraphByView(graph, 'skill_run')

    expect(skillGraph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'chapter:chapter-001' }),
        expect.objectContaining({ id: 'skill:xuanhuan.dialogue_polish' }),
        expect.objectContaining({
          kind: 'memory',
          layer: 'L2 风格',
        }),
        expect.objectContaining({
          kind: 'memory',
          layer: 'L0 事实',
        }),
      ]),
    )
    expect(skillGraph.nodes).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'codex' }),
        expect.objectContaining({ kind: 'plot_thread' }),
      ]),
    )
    expect(skillGraph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          to: 'skill:xuanhuan.dialogue_polish',
          label: '输入',
        }),
        expect.objectContaining({
          from: 'skill:xuanhuan.dialogue_polish',
          to: 'chapter:chapter-001',
          label: '待审',
        }),
      ]),
    )
  })

  it('summarizes visible graph counts and memory layers', () => {
    const graph = buildStoryGraph({
      activeChapter: chapter,
      runtimeMemoryPlan: memoryPlan,
      codexEntries: [codexEntry],
      plotThreads: [plotThread],
      publishPlan,
    })
    const memoryGraph = filterStoryGraphByView(graph, 'memory')
    const summary = summarizeStoryGraph(graph, memoryGraph)

    expect(summary.totalNodes).toBe(graph.nodes.length)
    expect(summary.visibleNodes).toBe(memoryGraph.nodes.length)
    expect(summary.nodesByKind).toMatchObject({
      chapter: 1,
      memory: 4,
      codex: 1,
      plot_thread: 1,
      publish_job: 1,
    })
    expect(summary.memoryLayers).toEqual({
      'L2 风格': 1,
      'L0 事实': 1,
      'L3 意图': 1,
      'L1 剧情': 1,
    })
  })

  it('adds a publish job node for the pending publish plan', () => {
    const graph = buildStoryGraph({
      activeChapter: chapter,
      runtimeMemoryPlan: memoryPlan,
      codexEntries: [codexEntry],
      plotThreads: [plotThread],
      publishPlan,
    })

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'publish:publisher:chapter-001',
          kind: 'publish_job',
          label: 'publisher 预检',
          detail: expect.stringContaining('pending:1'),
        }),
      ]),
    )
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'chapter:chapter-001',
          to: 'publish:publisher:chapter-001',
          label: '待发布',
        }),
      ]),
    )
  })

  it('summarizes the latest publisher preview report', () => {
    const graph = buildStoryGraph({
      activeChapter: chapter,
      runtimeMemoryPlan: memoryPlan,
      codexEntries: [codexEntry],
      plotThreads: [plotThread],
      publishPlan,
      publisherReport,
    })

    expect(graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'publish:dry-run:chapter-001',
          kind: 'publish_job',
          label: 'dry-run 预检',
          detail: expect.stringContaining('succeeded:1'),
        }),
      ]),
    )
    const publishContext = getStoryGraphNodeContext(
      graph,
      'publish:dry-run:chapter-001',
    )

    expect(publishContext?.incoming).toEqual([
      expect.objectContaining({
        edge: expect.objectContaining({ label: '预检' }),
        node: expect.objectContaining({ id: 'chapter:chapter-001' }),
      }),
    ])
    expect(publishContext?.outgoing).toHaveLength(0)
  })
})
