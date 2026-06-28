import { describe, expect, it } from 'vitest'
import { mockProvider } from '@/ai/mockProvider'
import { createNovelAgentToolRuntime } from '@/agent-tools/novelAgentRuntime'
import { createChapterDraftStore } from '@/project/chapterDraftStore'
import { loadDemoProject } from '@/project/demoProjectRepository'
import {
  buildEditorPublisherAdapterCatalog,
  type EditorPublisherAdapterCatalog,
} from '@/publisher/editorPublisher'
import { loadSkillCatalog } from '@/skills/skillCatalog'
import {
  agentReadActions,
  agentReviewActions,
  agentToolActions,
  agentToolCount,
  countAgentToolsByRisk,
  formatAgentToolInput,
  formatAgentToolResultSummary,
} from './agentToolDisplay'

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

function createRuntime() {
  const project = loadDemoProject()
  const draftStore = createChapterDraftStore(project.chapters)

  return createNovelAgentToolRuntime({
    project,
    draftStore,
    activeChapterId: project.chapters[0].id,
    skillCatalog: loadSkillCatalog(),
    provider: mockProvider,
    publisherAdapterCatalog: publisherCatalog,
  })
}

describe('agent tool display helpers', () => {
  it('summarizes the tool bridge shape for the Skills panel', () => {
    expect(agentToolCount).toBe(8)
    expect(countAgentToolsByRisk('read')).toBe(4)
    expect(countAgentToolsByRisk('reviewed_write')).toBe(3)
    expect(countAgentToolsByRisk('dry_run')).toBe(1)
    expect(agentToolActions.map((action) => action.name)).toEqual([
      'novel_get_project_state',
      'novel_get_current_chapter',
      'novel_get_memory_plan',
      'novel_list_story_graph_nodes',
      'novel_run_publisher_dry_run',
      'novel_run_skill',
      'novel_propose_rewrite_patch',
      'novel_propose_memory_update',
    ])
    expect(agentReadActions.map((action) => action.name)).toEqual([
      'novel_get_project_state',
      'novel_get_current_chapter',
      'novel_get_memory_plan',
      'novel_list_story_graph_nodes',
      'novel_run_publisher_dry_run',
    ])
    expect(agentReviewActions.map((action) => action.name)).toEqual([
      'novel_run_skill',
      'novel_propose_rewrite_patch',
      'novel_propose_memory_update',
    ])
  })

  it('formats empty and project-state executions compactly', async () => {
    const runtime = createRuntime()
    const execution = await runtime.runTool('novel_get_project_state', {
      includeProviders: true,
      includePublisher: true,
    })

    expect(formatAgentToolInput(null)).toBe('none')
    expect(formatAgentToolResultSummary(null)).toBe('尚未运行工具')
    expect(formatAgentToolInput(execution)).toBe(
      '{"includeProviders":true,"includePublisher":true}',
    )
    expect(formatAgentToolResultSummary(execution)).toBe(
      '2 chapters · 3 codex · 2 pending',
    )
  })

  it('formats memory, graph, Skill, proposal, and dry-run results', async () => {
    const runtime = createRuntime()
    const memoryExecution = await runtime.runTool('novel_get_memory_plan')
    const filteredMemoryExecution = await runtime.runTool('novel_get_memory_plan', {
      sourceFamilies: ['codex'],
    })
    const graphExecution = await runtime.runTool('novel_list_story_graph_nodes', {
      includeEdges: true,
    })
    const skillExecution = await runtime.runTool('novel_run_skill', {
      skillId: 'xuanhuan.dialogue_polish',
      selectedText: '李长老站在石阶尽头',
    })
    const rewriteExecution = await runtime.runTool('novel_propose_rewrite_patch', {
      original: '李长老站在石阶尽头',
      proposed: '李长老立在石阶尽头。',
    })
    const dryRunExecution = await runtime.runTool('novel_run_publisher_dry_run', {
      adapterId: 'dry-run',
      limit: 1,
    })

    expect(formatAgentToolInput(memoryExecution)).toBe('default')
    expect(formatAgentToolResultSummary(memoryExecution)).toContain('memories')
    expect(formatAgentToolResultSummary(memoryExecution)).not.toContain('filtered')
    expect(formatAgentToolResultSummary(filteredMemoryExecution)).toContain('3/')
    expect(formatAgentToolResultSummary(filteredMemoryExecution)).toContain(
      'memories · filtered',
    )
    expect(formatAgentToolResultSummary(graphExecution)).toContain('nodes')
    expect(formatAgentToolResultSummary(skillExecution)).toContain('review')
    expect(formatAgentToolResultSummary(rewriteExecution)).toContain(
      'snapshot required',
    )
    expect(formatAgentToolResultSummary(dryRunExecution)).toBe(
      '1/1 dry-run passed',
    )
  })
})
