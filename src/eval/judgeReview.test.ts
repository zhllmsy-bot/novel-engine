import { describe, expect, it } from 'vitest'
import { buildPairwiseJudgePrompt } from './judgeReview'

describe('judge review prompt', () => {
  it('builds a parseable blind pairwise review prompt', () => {
    const prompt = buildPairwiseJudgePrompt({
      runId: 'run-1',
      chapterId: 'chapter-006',
      repeatIndex: 1,
      leftSample: '样本一',
      rightSample: '样本二',
    })

    expect(prompt).toContain('样本 A:')
    expect(prompt).toContain('样本 B:')
    expect(prompt).toContain('"choice":"A|B|tie"')
  })
})
