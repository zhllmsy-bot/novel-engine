export const memorySourceFamilyOrder = [
  'manuscript',
  'codex',
  'project',
  'chapter_summary',
  'volume_summary',
  'plot_thread',
  'character_state_log',
  'recall',
  'other',
] as const

export type MemorySourceFamily = (typeof memorySourceFamilyOrder)[number]

export const memorySourceFamilyLabels = {
  manuscript: '正文',
  codex: '设定',
  project: '项目',
  chapter_summary: '章摘要',
  volume_summary: '卷摘要',
  plot_thread: '伏笔',
  character_state_log: '状态',
  recall: '召回',
  other: '其他',
} as const satisfies Record<MemorySourceFamily, string>
