import { describe, expect, it } from 'vitest'
import {
  getNovelAgentToolDefinition,
  novelAgentToolDefinitions,
  novelAgentToolDescriptions,
  novelAgentToolNames,
  parseNovelAgentToolInput,
} from './novelAgentTools'

describe('novel agent tool contract', () => {
  it('exposes a stable whitelist of editor tools for future Agent bridges', () => {
    expect(novelAgentToolDefinitions.map((tool) => tool.name)).toEqual(
      novelAgentToolNames,
    )
    expect(novelAgentToolNames).toEqual([
      'novel_get_project_state',
      'novel_get_current_chapter',
      'novel_get_memory_plan',
      'novel_list_story_graph_nodes',
      'novel_run_skill',
      'novel_propose_rewrite_patch',
      'novel_propose_memory_update',
      'novel_run_publisher_dry_run',
    ])
    expect(novelAgentToolDescriptions.novel_get_memory_plan).toContain(
      'L0/L1/L2/L3',
    )
  })

  it('keeps read tools review-free and mutation-shaped tools reviewable', () => {
    const readTools = novelAgentToolDefinitions.filter(
      (tool) => tool.policy.risk === 'read',
    )
    const reviewedTools = novelAgentToolDefinitions.filter(
      (tool) => tool.policy.risk === 'reviewed_write',
    )

    expect(readTools.map((tool) => tool.name)).toEqual([
      'novel_get_project_state',
      'novel_get_current_chapter',
      'novel_get_memory_plan',
      'novel_list_story_graph_nodes',
    ])
    expect(readTools.every((tool) => !tool.policy.requiresReview)).toBe(true)
    expect(reviewedTools.map((tool) => tool.name)).toEqual([
      'novel_run_skill',
      'novel_propose_rewrite_patch',
      'novel_propose_memory_update',
    ])
    expect(reviewedTools.every((tool) => tool.policy.requiresReview)).toBe(true)
  })

  it('marks publisher execution as dry-run only', () => {
    expect(getNovelAgentToolDefinition('novel_run_publisher_dry_run')).toMatchObject({
      policy: {
        risk: 'dry_run',
        requiresReview: false,
        dryRunOnly: true,
      },
    })
    expect(
      parseNovelAgentToolInput('novel_run_publisher_dry_run', {
        adapterId: 'dry-run',
        limit: 1,
      }),
    ).toEqual({ adapterId: 'dry-run', limit: 1 })
  })

  it('validates project-state extension catalog flags', () => {
    expect(
      parseNovelAgentToolInput('novel_get_project_state', {
        includeCodex: true,
        includeProviders: true,
        includePublisher: true,
        includeSkillCatalog: true,
      }),
    ).toEqual({
      includeCodex: true,
      includeProviders: true,
      includePublisher: true,
      includeSkillCatalog: true,
    })
  })

  it('validates four-layer memory and story graph inputs', () => {
    expect(
      parseNovelAgentToolInput('novel_get_memory_plan', {
        chapterId: 'chapter-001',
        budgetChars: 900,
        includeLayers: ['L2 风格', 'L0 事实'],
        sourceFamilies: ['codex'],
        sourceContains: ['codex/characters/'],
      }),
    ).toEqual({
      chapterId: 'chapter-001',
      budgetChars: 900,
      includeLayers: ['L2 风格', 'L0 事实'],
      sourceFamilies: ['codex'],
      sourceContains: ['codex/characters/'],
    })
    expect(
      parseNovelAgentToolInput('novel_list_story_graph_nodes', {
        kind: 'plot_thread',
        includeEdges: true,
      }),
    ).toEqual({ kind: 'plot_thread', includeEdges: true })
    expect(() =>
      parseNovelAgentToolInput('novel_get_memory_plan', {
        includeLayers: ['vector_memory'],
      }),
    ).toThrow()
    expect(() =>
      parseNovelAgentToolInput('novel_get_memory_plan', {
        sourceFamilies: ['vector_memory'],
      }),
    ).toThrow()
    expect(() =>
      parseNovelAgentToolInput('novel_get_memory_plan', {
        sourceContains: [''],
      }),
    ).toThrow()
  })

  it('rejects unsafe direct-write shaped inputs', () => {
    expect(() =>
      parseNovelAgentToolInput('novel_propose_rewrite_patch', {
        original: '旧稿',
        proposed: '新稿',
        applyImmediately: true,
      }),
    ).toThrow()
    expect(() =>
      parseNovelAgentToolInput('novel_propose_memory_update', {
        kind: 'character_state',
        title: '李长老修为',
        evidence: '正文明确写到突破。',
        payload: {
          characterName: '李长老',
          field: '修为',
          to: '金丹期',
        },
        confirmed: true,
      }),
    ).toThrow()
  })
})
