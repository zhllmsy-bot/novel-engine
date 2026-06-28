import { describe, expect, it } from 'vitest'
import { mockProvider } from '@/ai/mockProvider'
import {
  buildProviderAdapterCatalog,
  type ProviderAdapterCatalog,
} from '@/ai/providerCatalog'
import { createChapterDraftStore } from '@/project/chapterDraftStore'
import { loadDemoProject } from '@/project/demoProjectRepository'
import {
  buildEditorPublisherAdapterCatalog,
  type EditorPublisherAdapterCatalog,
} from '@/publisher/editorPublisher'
import { loadSkillCatalog } from '@/skills/skillCatalog'
import { createNovelAgentToolRuntime } from './novelAgentRuntime'

const publisherCatalog: EditorPublisherAdapterCatalog =
  buildEditorPublisherAdapterCatalog([
    {
      path: 'publisher/adapters/dry-run/publisher.adapter.json',
      source: JSON.stringify({
        $schema: '../../../schemas/publisher-adapter.schema.json',
        id: 'dry-run',
        display_name: 'Dry Run Publisher',
        description: '本地预检发布载荷，不触碰平台账号。',
        status: 'available',
        runtime: {
          editor_dry_run: true,
        },
        capabilities: ['预检章节载荷'],
      }),
      sourceKind: 'bundled',
    },
  ])

const providerCatalog: ProviderAdapterCatalog = buildProviderAdapterCatalog([
  {
    path: 'providers/mock/provider.adapter.json',
    source: JSON.stringify({
      $schema: '../../schemas/provider-adapter.schema.json',
      id: 'mock',
      label: 'Mock',
      kind: 'local',
      description: '本地模拟 Provider。',
      status: 'available',
      config_fields: [],
      capabilities: ['本地验证'],
    }),
    sourceKind: 'bundled',
  },
  {
    path: 'providers/local-qwen/provider.adapter.json',
    source: JSON.stringify({
      $schema: '../../schemas/provider-adapter.schema.json',
      id: 'local-qwen',
      label: 'Local Qwen',
      kind: 'openai-compatible',
      description: 'Project local provider.',
      status: 'configured',
      config_fields: ['baseUrl', 'model'],
      capabilities: ['项目本地 Provider'],
    }),
    sourceKind: 'project',
  },
  {
    path: 'providers/broken/provider.adapter.json',
    source: JSON.stringify({
      $schema: '../../schemas/provider-adapter.schema.json',
      id: 'Broken Provider',
      label: '',
      kind: 'wat',
      description: 'Broken.',
      status: 'planned',
      config_fields: ['token'],
      capabilities: [],
    }),
    sourceKind: 'project',
  },
])

function createRuntime() {
  const project = loadDemoProject()
  const draftStore = createChapterDraftStore(project.chapters)

  draftStore.updateDraft(
    project.chapters[0].id,
    `${project.chapters[0].content}\n\n玄铁剑在雨声里又轻轻震了一下。`,
  )

  return createNovelAgentToolRuntime({
    project,
    draftStore,
    activeChapterId: project.chapters[0].id,
    selectedText: '李长老站在石阶尽头',
    skillCatalog: loadSkillCatalog(),
    provider: mockProvider,
    providerAdapterCatalog: providerCatalog,
    publisherAdapterCatalog: publisherCatalog,
  })
}

function createRuntimeWithDerivedMemory() {
  const project = loadDemoProject()
  const draftStore = createChapterDraftStore(project.chapters)

  draftStore.updateDraft(
    project.chapters[1].id,
    '沈微被带到剑阁时，玄铁剑在鞘中又响了一次。李长老让他记住山门雨夜问过的话，旧账不会只停在一把剑上。',
  )

  return createNovelAgentToolRuntime({
    project,
    draftStore,
    activeChapterId: project.chapters[1].id,
    skillCatalog: loadSkillCatalog(),
    provider: mockProvider,
    providerAdapterCatalog: providerCatalog,
    publisherAdapterCatalog: publisherCatalog,
    chapterSummaries: [
      {
        chapterId: project.chapters[0].id,
        chapterTitle: project.chapters[0].title,
        summary: '山门雨夜，沈微听见玄铁剑鸣，李长老问起沈微师父。',
        keyEvents: ['沈微听见玄铁剑鸣', '李长老问起师父'],
        charactersInvolved: ['li-zhanglao'],
        sourceHash: 'test:chapter-001',
        isEdited: false,
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    characterStateLogs: [
      {
        id: 'state-1',
        kind: 'character_state',
        characterName: '李长老',
        field: '态度',
        from: '审视',
        to: '试探沈微',
        reason: '山门雨夜主动问起沈微师父。',
        evidence: '你师父还活着吗？',
        confidence: 'medium',
        chapterId: project.chapters[0].id,
        chapterTitle: project.chapters[0].title,
        sourceSkillId: 'test.state',
        confirmedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
    plotThreads: [
      {
        id: 'plot:chapter-001:玄铁剑:1',
        title: '玄铁剑鸣',
        content: '玄铁剑第一次发出声音，暗示旧账未清。',
        plantedChapterId: project.chapters[0].id,
        plantedChapterTitle: project.chapters[0].title,
        keywords: ['玄铁剑', '旧账'],
        status: 'open',
        confirmed: true,
        sourceSkillId: 'test.thread',
        confirmedAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ],
  })
}

function createRuntimeWithIndexedRecall() {
  const project = loadDemoProject()
  const draftStore = createChapterDraftStore(project.chapters)

  draftStore.updateDraft(
    project.chapters[1].id,
    '沈微抵达剑阁时，再次想起玄铁剑第一次鸣响的雨夜。',
  )

  return createNovelAgentToolRuntime({
    project,
    draftStore,
    activeChapterId: project.chapters[1].id,
    skillCatalog: loadSkillCatalog(),
    provider: mockProvider,
    providerAdapterCatalog: providerCatalog,
    publisherAdapterCatalog: publisherCatalog,
    indexedRecallResults: [
      {
        chapterId: project.chapters[0].id,
        chapterTitle: project.chapters[0].title,
        sourcePath: project.chapters[0].path,
        snippet: '沈微第一次听见玄铁剑在山门雨夜里鸣响。',
        score: 0.91,
        source: 'content',
      },
    ],
  })
}

describe('novel agent tool runtime', () => {
  it('reads project state without returning full manuscript by default', async () => {
    const runtime = createRuntime()
    const execution = await runtime.runTool('novel_get_project_state', {
      includeChapters: true,
      includeCodex: true,
      includeProviders: true,
      includePublisher: true,
      includeSkillCatalog: true,
    })

    expect(execution.policy).toEqual({ risk: 'read', requiresReview: false })
    expect(execution.result).toMatchObject({
      tool: 'novel_get_project_state',
      project: {
        title: '玄铁剑鸣',
        sourceOfTruth: 'markdown',
        chapterCount: 2,
        codexCount: 3,
      },
    })
    if (execution.result.tool !== 'novel_get_project_state') {
      throw new Error('unexpected result')
    }
    expect(execution.result.chapters?.[0]).toMatchObject({
      title: '第001章 山门雨',
      draftStatus: 'dirty',
    })
    expect(execution.result.chapters?.[0]).not.toHaveProperty('content')
    expect(execution.result.codex?.[0]).toMatchObject({
      name: '李长老',
      path: 'codex/characters/li-zhanglao.md',
    })
    expect(execution.result.publisher?.adapters[0]).toMatchObject({
      id: 'dry-run',
      source: 'bundled',
      editorDryRun: true,
    })
    expect(execution.result.providers?.adapters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'local-qwen',
          sourceKind: 'project',
          path: 'providers/local-qwen/provider.adapter.json',
          configFields: ['baseUrl', 'model'],
        }),
      ]),
    )
    expect(execution.result.providers?.errors[0]).toContain(
      'providers/broken/provider.adapter.json',
    )
    expect(
      execution.result.skillCatalog?.skills.map((skill) => skill.id),
    ).toContain('xuanhuan.dialogue_polish')
    expect(
      execution.result.skillCatalog?.skills.find(
        (skill) => skill.id === 'xuanhuan.dialogue_polish',
      ),
    ).toMatchObject({
      source: 'bundled_yaml',
      path: 'examples/skills/xuanhuan-dialogue-polish.skill.yaml',
    })
  })

  it('reads current chapter content only when requested', async () => {
    const runtime = createRuntime()
    const execution = await runtime.runTool('novel_get_current_chapter', {
      includeContent: true,
      includeDraft: true,
    })

    expect(execution.result.tool).toBe('novel_get_current_chapter')
    if (execution.result.tool !== 'novel_get_current_chapter') {
      throw new Error('unexpected result')
    }
    expect(execution.result.chapter.content).toContain('沈微第一次听见玄铁剑')
    expect(execution.result.chapter.draft?.content).toContain('又轻轻震了一下')
    expect(execution.result.chapter.draft?.status).toBe('dirty')
  })

  it('builds a four-layer memory plan and story graph from editor state', async () => {
    const runtime = createRuntime()
    const memoryExecution = await runtime.runTool('novel_get_memory_plan', {
      includeLayers: ['L2 风格', 'L0 事实'],
    })
    const graphExecution = await runtime.runTool('novel_list_story_graph_nodes', {
      includeEdges: true,
      selectedOnly: true,
    })

    expect(memoryExecution.result.tool).toBe('novel_get_memory_plan')
    if (memoryExecution.result.tool !== 'novel_get_memory_plan') {
      throw new Error('unexpected result')
    }
    expect(memoryExecution.result.plan.memories.map((memory) => memory.layer)).toEqual(
      expect.arrayContaining(['L2 风格', 'L0 事实']),
    )
    expect(
      memoryExecution.result.plan.memories.every((memory) =>
        ['L2 风格', 'L0 事实'].includes(memory.layer),
      ),
    ).toBe(true)
    expect(memoryExecution.result.filter).toMatchObject({
      includeLayers: ['L2 风格', 'L0 事实'],
      returnedMemoryCount: memoryExecution.result.plan.memories.length,
      filtered: true,
    })
    expect(memoryExecution.result.filter.returnedSourceSummary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          family: 'manuscript',
          label: '正文',
          memoryCount: 1,
          sourceCount: 1,
          sources: ['manuscript/volume-001/chapter-001.md'],
        }),
        expect.objectContaining({
          family: 'codex',
          label: '设定',
          memoryCount: 3,
          sourceCount: 3,
          sources: [
            'codex/locations/xuantianzong-gate.md',
            'codex/characters/li-zhanglao.md',
            'codex/locations/sword-pavilion.md',
          ],
        }),
      ]),
    )
    expect(memoryExecution.result.filter.originalMemoryCount).toBeGreaterThan(
      memoryExecution.result.filter.returnedMemoryCount,
    )

    expect(graphExecution.result.tool).toBe('novel_list_story_graph_nodes')
    if (graphExecution.result.tool !== 'novel_list_story_graph_nodes') {
      throw new Error('unexpected result')
    }
    expect(graphExecution.result.graph.nodes.map((node) => node.kind)).toEqual(
      expect.arrayContaining(['chapter', 'memory', 'codex', 'publish_job']),
    )
    expect(graphExecution.result.graph.edges.length).toBeGreaterThan(0)
    expect(graphExecution.result.selected?.node.kind).toBe('chapter')
  })

  it('filters memory plans by source substring for provenance-focused agent reads', async () => {
    const runtime = createRuntime()
    const execution = await runtime.runTool('novel_get_memory_plan', {
      sourceContains: ['codex/characters/'],
    })

    expect(execution.result.tool).toBe('novel_get_memory_plan')
    if (execution.result.tool !== 'novel_get_memory_plan') {
      throw new Error('unexpected result')
    }
    expect(execution.result.plan.memories).toHaveLength(1)
    expect(execution.result.plan.memories[0]).toMatchObject({
      layer: 'L0 事实',
      source: 'codex/characters/li-zhanglao.md',
    })
    expect(execution.result.filter).toMatchObject({
      sourceContains: ['codex/characters/'],
      returnedMemoryCount: 1,
      filtered: true,
    })
    expect(execution.result.filter.returnedSourceSummary).toEqual([
      expect.objectContaining({
        family: 'codex',
        label: '设定',
        memoryCount: 1,
        sourceCount: 1,
        sources: ['codex/characters/li-zhanglao.md'],
      }),
    ])
    expect(execution.result.filter.originalMemoryCount).toBeGreaterThan(1)
  })

  it('filters memory plans by stable source family for agent reads', async () => {
    const runtime = createRuntime()
    const execution = await runtime.runTool('novel_get_memory_plan', {
      sourceFamilies: ['codex'],
    })

    expect(execution.result.tool).toBe('novel_get_memory_plan')
    if (execution.result.tool !== 'novel_get_memory_plan') {
      throw new Error('unexpected result')
    }
    expect(execution.result.plan.memories).toHaveLength(3)
    expect(execution.result.plan.memories.map((memory) => memory.source)).toEqual([
      'codex/locations/xuantianzong-gate.md',
      'codex/characters/li-zhanglao.md',
      'codex/locations/sword-pavilion.md',
    ])
    expect(execution.result.filter).toMatchObject({
      sourceFamilies: ['codex'],
      returnedMemoryCount: 3,
      filtered: true,
    })
    expect(execution.result.filter.returnedSourceSummary).toEqual([
      expect.objectContaining({
        family: 'codex',
        label: '设定',
        memoryCount: 3,
        sourceCount: 3,
        sources: [
          'codex/locations/xuantianzong-gate.md',
          'codex/characters/li-zhanglao.md',
          'codex/locations/sword-pavilion.md',
        ],
      }),
    ])
    expect(execution.result.filter.originalSourceSummary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ family: 'manuscript' }),
        expect.objectContaining({ family: 'codex' }),
        expect.objectContaining({ family: 'project' }),
      ]),
    )
  })

  it('marks unfiltered memory plan reads as complete plans', async () => {
    const runtime = createRuntime()
    const execution = await runtime.runTool('novel_get_memory_plan')

    expect(execution.result.tool).toBe('novel_get_memory_plan')
    if (execution.result.tool !== 'novel_get_memory_plan') {
      throw new Error('unexpected result')
    }
    expect(execution.result.filter).toMatchObject({
      filtered: false,
      originalMemoryCount: execution.result.plan.memories.length,
      returnedMemoryCount: execution.result.plan.memories.length,
    })
    expect(execution.result.filter.originalSourceSummary).toBe(
      execution.result.filter.returnedSourceSummary,
    )
    expect(execution.result.filter.returnedSourceSummary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ family: 'manuscript', label: '正文' }),
        expect.objectContaining({ family: 'codex', label: '设定' }),
        expect.objectContaining({ family: 'project', label: '项目' }),
      ]),
    )
  })

  it('summarizes derived memory source families for agent provenance audits', async () => {
    const runtime = createRuntimeWithDerivedMemory()
    const execution = await runtime.runTool('novel_get_memory_plan', {
      budgetChars: 2000,
    })

    expect(execution.result.tool).toBe('novel_get_memory_plan')
    if (execution.result.tool !== 'novel_get_memory_plan') {
      throw new Error('unexpected result')
    }
    expect(execution.result.filter.returnedSourceSummary).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          family: 'character_state_log',
          label: '状态',
          sources: ['character_state_log:state-1'],
        }),
        expect.objectContaining({
          family: 'recall',
          label: '召回',
          sources: [
            'recall:plot_thread:plot:chapter-001:玄铁剑:1',
            'recall:chapter_summary:chapter-001',
          ],
        }),
        expect.objectContaining({
          family: 'chapter_summary',
          label: '章摘要',
          sources: ['chapter_summary:chapter-001'],
        }),
        expect.objectContaining({
          family: 'plot_thread',
          label: '伏笔',
          sources: ['plot_thread:plot:chapter-001:玄铁剑:1'],
        }),
      ]),
    )
  })

  it('filters derived memory plans by concrete recall source family', async () => {
    const runtime = createRuntimeWithDerivedMemory()
    const execution = await runtime.runTool('novel_get_memory_plan', {
      budgetChars: 2000,
      sourceFamilies: ['recall'],
    })

    expect(execution.result.tool).toBe('novel_get_memory_plan')
    if (execution.result.tool !== 'novel_get_memory_plan') {
      throw new Error('unexpected result')
    }
    expect(execution.result.plan.memories).toHaveLength(2)
    expect(
      execution.result.plan.memories.every((memory) =>
        memory.source.startsWith('recall:'),
      ),
    ).toBe(true)
    expect(execution.result.filter).toMatchObject({
      sourceFamilies: ['recall'],
      filtered: true,
      returnedMemoryCount: 2,
    })
    expect(execution.result.filter.returnedSourceSummary).toEqual([
      expect.objectContaining({
        family: 'recall',
        label: '召回',
        memoryCount: 2,
        sourceCount: 2,
        sources: [
          'recall:plot_thread:plot:chapter-001:玄铁剑:1',
          'recall:chapter_summary:chapter-001',
        ],
      }),
    ])
  })

  it('passes indexed recall into agent memory plans as stable recall provenance', async () => {
    const runtime = createRuntimeWithIndexedRecall()
    const execution = await runtime.runTool('novel_get_memory_plan', {
      budgetChars: 2000,
      sourceFamilies: ['recall'],
    })

    expect(execution.result.tool).toBe('novel_get_memory_plan')
    if (execution.result.tool !== 'novel_get_memory_plan') {
      throw new Error('unexpected result')
    }

    expect(execution.result.plan.memories).toHaveLength(1)
    expect(execution.result.plan.memories[0]).toMatchObject({
      layer: 'L3 意图',
      source: 'recall:index:chapter-001',
    })
    expect(execution.result.plan.memories[0].body).toContain('索引召回')
    expect(execution.result.filter).toMatchObject({
      sourceFamilies: ['recall'],
      filtered: true,
      returnedMemoryCount: 1,
    })
    expect(execution.result.filter.returnedSourceSummary).toEqual([
      expect.objectContaining({
        family: 'recall',
        label: '召回',
        memoryCount: 1,
        sourceCount: 1,
        sources: ['recall:index:chapter-001'],
      }),
    ])
  })

  it('runs a Skill through the provider but returns a reviewable result', async () => {
    const runtime = createRuntime()
    const execution = await runtime.runTool('novel_run_skill', {
      skillId: 'xuanhuan.dialogue_polish',
      selectedText: '李长老站在石阶尽头',
      userInstruction: '增强压迫感。',
    })

    expect(execution.policy).toEqual({
      risk: 'reviewed_write',
      requiresReview: true,
    })
    expect(execution.result.tool).toBe('novel_run_skill')
    if (execution.result.tool !== 'novel_run_skill') {
      throw new Error('unexpected result')
    }
    expect(execution.result.reviewRequired).toBe(true)
    expect(execution.result.audit.skill.id).toBe('xuanhuan.dialogue_polish')
    expect(execution.result.result.type).toBe('rewrite_patch')
  })

  it('wraps rewrite and memory changes as proposals instead of mutations', async () => {
    const runtime = createRuntime()
    const rewriteExecution = await runtime.runTool('novel_propose_rewrite_patch', {
      original: '李长老站在石阶尽头',
      proposed: '李长老立在石阶尽头，像一枚压住山门的冷铁。',
      reason: '增强画面压迫感。',
    })
    const memoryExecution = await runtime.runTool('novel_propose_memory_update', {
      kind: 'character_state',
      title: '李长老修为',
      evidence: '人物卡明确写有金丹期。',
      confidence: 'medium',
      payload: {
        characterName: '李长老',
        field: '修为',
        to: '金丹期',
      },
    })

    expect(rewriteExecution.result.tool).toBe('novel_propose_rewrite_patch')
    if (rewriteExecution.result.tool !== 'novel_propose_rewrite_patch') {
      throw new Error('unexpected result')
    }
    expect(rewriteExecution.result.reviewRequired).toBe(true)
    expect(rewriteExecution.result.patch.requiresSnapshot).toBe(true)
    expect(rewriteExecution.result.validation.ok).toBe(true)

    expect(memoryExecution.result.tool).toBe('novel_propose_memory_update')
    if (memoryExecution.result.tool !== 'novel_propose_memory_update') {
      throw new Error('unexpected result')
    }
    expect(memoryExecution.result.reviewRequired).toBe(true)
    expect(memoryExecution.result.proposal).toMatchObject({
      kind: 'character_state',
      characterName: '李长老',
      field: '修为',
      to: '金丹期',
    })
  })

  it('runs publisher preview through the dry-run boundary', async () => {
    const runtime = createRuntime()
    const execution = await runtime.runTool('novel_run_publisher_dry_run', {
      adapterId: 'dry-run',
      limit: 1,
    })

    expect(execution.policy).toEqual({
      risk: 'dry_run',
      requiresReview: false,
      dryRunOnly: true,
    })
    expect(execution.result.tool).toBe('novel_run_publisher_dry_run')
    if (execution.result.tool !== 'novel_run_publisher_dry_run') {
      throw new Error('unexpected result')
    }
    expect(execution.result.dryRunOnly).toBe(true)
    expect(execution.result.report).toMatchObject({
      adapterId: 'dry-run',
      attempted: 1,
      succeeded: 1,
      failed: 0,
    })
  })
})
