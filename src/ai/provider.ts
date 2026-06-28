import type { SkillRunRequest, SkillRunResult } from '../types/domain'

export type ModelProvider = {
  id: string
  label: string
  runSkill(request: SkillRunRequest): Promise<SkillRunResult>
}
