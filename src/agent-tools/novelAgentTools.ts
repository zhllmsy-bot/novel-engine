import { z } from 'zod'

import type { StoryGraphNodeKind } from '@/inspector/storyGraph'
import { memorySourceFamilyOrder } from '@/types/memorySourceFamilies'

const graphNodeKindSchema = z.enum([
  'chapter',
  'memory',
  'codex',
  'plot_thread',
  'skill_run',
  'publish_job',
] satisfies StoryGraphNodeKind[])

const memoryLayerSchema = z.enum(['L0 事实', 'L1 剧情', 'L2 风格', 'L3 意图'])

const memorySourceFamilySchema = z.enum(memorySourceFamilyOrder)

export const novelAgentToolNames = [
  'novel_get_project_state',
  'novel_get_current_chapter',
  'novel_get_memory_plan',
  'novel_list_story_graph_nodes',
  'novel_run_skill',
  'novel_propose_rewrite_patch',
  'novel_propose_memory_update',
  'novel_run_publisher_dry_run',
] as const

export type NovelAgentToolName = (typeof novelAgentToolNames)[number]

export type NovelAgentToolRisk = 'read' | 'reviewed_write' | 'dry_run'

export type NovelAgentToolPolicy = {
  risk: NovelAgentToolRisk
  requiresReview: boolean
  dryRunOnly?: boolean
}

export type NovelAgentToolDefinition = {
  name: NovelAgentToolName
  title: string
  description: string
  policy: NovelAgentToolPolicy
  inputSchema: z.ZodType
}

export const novelAgentToolInputSchemas = {
  novel_get_project_state: z
    .object({
      includeChapters: z.boolean().optional(),
      includeCodex: z.boolean().optional(),
      includeProviders: z.boolean().optional(),
      includePublisher: z.boolean().optional(),
      includeSkillCatalog: z.boolean().optional(),
    })
    .strict(),
  novel_get_current_chapter: z
    .object({
      includeContent: z.boolean().optional(),
      includeDraft: z.boolean().optional(),
    })
    .strict(),
  novel_get_memory_plan: z
    .object({
      chapterId: z.string().min(1).optional(),
      budgetChars: z.number().int().positive().optional(),
      skillId: z.string().min(1).optional(),
      includeLayers: z.array(memoryLayerSchema).optional(),
      sourceFamilies: z.array(memorySourceFamilySchema).optional(),
      sourceContains: z.array(z.string().min(1)).optional(),
    })
    .strict(),
  novel_list_story_graph_nodes: z
    .object({
      kind: graphNodeKindSchema.optional(),
      includeEdges: z.boolean().optional(),
      selectedOnly: z.boolean().optional(),
    })
    .strict(),
  novel_run_skill: z
    .object({
      skillId: z.string().min(1),
      userInstruction: z.string().optional(),
      selectedText: z.string().optional(),
    })
    .strict(),
  novel_propose_rewrite_patch: z
    .object({
      skillId: z.string().min(1).optional(),
      original: z.string().min(1),
      proposed: z.string().min(1),
      reason: z.string().optional(),
    })
    .strict(),
  novel_propose_memory_update: z
    .object({
      kind: z.enum(['character_state', 'plot_thread']),
      title: z.string().min(1),
      evidence: z.string().min(1),
      confidence: z.enum(['low', 'medium', 'high']).optional(),
      payload: z.record(z.string(), z.unknown()),
    })
    .strict(),
  novel_run_publisher_dry_run: z
    .object({
      adapterId: z.string().min(1).default('dry-run'),
      limit: z.number().int().positive().optional(),
    })
    .strict(),
} satisfies Record<NovelAgentToolName, z.ZodType>

export const novelAgentToolDefinitions = [
  {
    name: 'novel_get_project_state',
    title: '读取项目状态',
    description:
      '读取当前小说项目的章节、设定、Provider、Skill 和发布适配器概览，不返回大段正文。',
    policy: { risk: 'read', requiresReview: false },
    inputSchema: novelAgentToolInputSchemas.novel_get_project_state,
  },
  {
    name: 'novel_get_current_chapter',
    title: '读取当前章节',
    description:
      '读取当前打开章节的元数据，可按需包含正文草稿，用于续写、审稿或上下文解释。',
    policy: { risk: 'read', requiresReview: false },
    inputSchema: novelAgentToolInputSchemas.novel_get_current_chapter,
  },
  {
    name: 'novel_get_memory_plan',
    title: '读取四层记忆',
    description:
      '读取指定章节的 L0/L1/L2/L3 上下文计划、预算审计和来源信息，可按层级、来源家族或来源字符串过滤。',
    policy: { risk: 'read', requiresReview: false },
    inputSchema: novelAgentToolInputSchemas.novel_get_memory_plan,
  },
  {
    name: 'novel_list_story_graph_nodes',
    title: '读取故事图谱',
    description:
      '读取可重建故事图谱节点和边，用于解释章节、记忆、设定、伏笔、Skill 和发布任务的关系。',
    policy: { risk: 'read', requiresReview: false },
    inputSchema: novelAgentToolInputSchemas.novel_list_story_graph_nodes,
  },
  {
    name: 'novel_run_skill',
    title: '运行 Skill',
    description:
      '运行一个 YAML 或内置 Skill，并返回报告、改写补丁或记忆更新提议；高风险结果仍需作者确认。',
    policy: { risk: 'reviewed_write', requiresReview: true },
    inputSchema: novelAgentToolInputSchemas.novel_run_skill,
  },
  {
    name: 'novel_propose_rewrite_patch',
    title: '提出改写补丁',
    description:
      '把 Agent 生成的正文改动包装成可审阅补丁，不直接写入 manuscript。',
    policy: { risk: 'reviewed_write', requiresReview: true },
    inputSchema: novelAgentToolInputSchemas.novel_propose_rewrite_patch,
  },
  {
    name: 'novel_propose_memory_update',
    title: '提出记忆更新',
    description:
      '提出人物状态或伏笔更新，必须带证据，进入人工确认队列后才能改变 L0/L1 记忆。',
    policy: { risk: 'reviewed_write', requiresReview: true },
    inputSchema: novelAgentToolInputSchemas.novel_propose_memory_update,
  },
  {
    name: 'novel_run_publisher_dry_run',
    title: '发布预检',
    description:
      '运行发布适配器 dry-run，只生成预检报告，不触碰平台账号或远程草稿。',
    policy: { risk: 'dry_run', requiresReview: false, dryRunOnly: true },
    inputSchema: novelAgentToolInputSchemas.novel_run_publisher_dry_run,
  },
] satisfies NovelAgentToolDefinition[]

export const novelAgentToolDescriptions = Object.fromEntries(
  novelAgentToolDefinitions.map((tool) => [tool.name, tool.description]),
) as Record<NovelAgentToolName, string>

export function getNovelAgentToolDefinition(name: NovelAgentToolName) {
  return novelAgentToolDefinitions.find((tool) => tool.name === name)
}

export function parseNovelAgentToolInput(
  name: NovelAgentToolName,
  input: unknown,
) {
  return novelAgentToolInputSchemas[name].parse(input)
}

export type NovelAgentToolInputs = {
  [Name in NovelAgentToolName]: z.infer<(typeof novelAgentToolInputSchemas)[Name]>
}
