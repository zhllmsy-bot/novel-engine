import type { NovelAgentToolExecution } from '@/agent-tools/novelAgentRuntime'
import {
  novelAgentToolDefinitions,
  type NovelAgentToolName,
  type NovelAgentToolRisk,
} from '@/agent-tools/novelAgentTools'

export const agentToolActions: {
  name: NovelAgentToolName
  label: string
  group: 'read' | 'review'
}[] = [
  { name: 'novel_get_project_state', label: '项目', group: 'read' },
  { name: 'novel_get_current_chapter', label: '章节', group: 'read' },
  { name: 'novel_get_memory_plan', label: '记忆', group: 'read' },
  { name: 'novel_list_story_graph_nodes', label: '图谱', group: 'read' },
  { name: 'novel_run_publisher_dry_run', label: '预检', group: 'read' },
  { name: 'novel_run_skill', label: '跑 Skill', group: 'review' },
  { name: 'novel_propose_rewrite_patch', label: '改写提案', group: 'review' },
  { name: 'novel_propose_memory_update', label: '记忆提案', group: 'review' },
]

export const agentReadActions = agentToolActions.filter(
  (action) => action.group === 'read',
)

export const agentReviewActions = agentToolActions.filter(
  (action) => action.group === 'review',
)

export const agentToolCount = novelAgentToolDefinitions.length

export const agentRiskLabel: Record<NovelAgentToolRisk, string> = {
  read: 'read',
  reviewed_write: 'review',
  dry_run: 'dry-run',
}

export function countAgentToolsByRisk(risk: NovelAgentToolRisk) {
  return novelAgentToolDefinitions.filter((tool) => tool.policy.risk === risk).length
}

export function formatAgentToolResultSummary(
  execution: NovelAgentToolExecution | null,
) {
  if (!execution) return '尚未运行工具'

  const { result } = execution

  switch (result.tool) {
    case 'novel_get_project_state':
      return `${result.project.chapterCount} chapters · ${result.project.codexCount} codex · ${result.publisher?.plan.pending ?? 0} pending`
    case 'novel_get_current_chapter':
      return `${result.chapter.title} · ${result.chapter.wordCount} chars · ${result.chapter.draftStatus || 'clean'}`
    case 'novel_get_memory_plan':
      return `${memoryPlanCountLabel(result)} · ${memoryPlanSourceLabel(result)} · ${result.plan.audit.usedChars}/${result.plan.audit.budgetChars}`
    case 'novel_list_story_graph_nodes':
      return `${result.graph.nodes.length} nodes · ${result.graph.edges.length} edges`
    case 'novel_run_skill':
      return `${result.audit.skill.name} · ${result.result.type} · ${result.reviewRequired ? 'review' : 'direct'}`
    case 'novel_propose_rewrite_patch':
      return `${result.validation.ok ? 'valid' : 'stale'} rewrite proposal · snapshot required`
    case 'novel_propose_memory_update':
      return `${result.proposal.kind} proposal · review required`
    case 'novel_run_publisher_dry_run':
      return `${result.report.succeeded}/${result.report.attempted} dry-run passed`
  }
}

function memoryPlanCountLabel(
  result: Extract<NovelAgentToolExecution['result'], { tool: 'novel_get_memory_plan' }>,
) {
  return result.filter.filtered
    ? `${result.filter.returnedMemoryCount}/${result.filter.originalMemoryCount} memories · filtered`
    : `${result.filter.returnedMemoryCount} memories`
}

function memoryPlanSourceLabel(
  result: Extract<NovelAgentToolExecution['result'], { tool: 'novel_get_memory_plan' }>,
) {
  const visibleSources = result.filter.returnedSourceSummary.slice(0, 3)
  const extraCount = result.filter.returnedSourceSummary.length - visibleSources.length
  const label = visibleSources
    .map((summary) => `${summary.label} ${summary.memoryCount}`)
    .join(' · ')

  return label
    ? `${label}${extraCount > 0 ? ` +${extraCount}` : ''}`
    : '无来源'
}

export function formatAgentToolInput(execution: NovelAgentToolExecution | null) {
  if (!execution) return 'none'

  const input = JSON.stringify(execution.input)
  return input === '{}' ? 'default' : input
}
