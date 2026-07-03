import { describe, expect, it } from 'vitest'
import {
  buildAuditPinnedJudgePrompt,
  buildL0PinnedAuditPackets,
  buildPairwiseJudgePrompt,
} from './judgeReview'
import type { CodexEntry } from '../project/projectTypes'

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

describe('L0-pinned audit packets', () => {
  const codexEntry: CodexEntry = {
    id: 'item-bell',
    name: '铜铃',
    type: 'item',
    path: 'codex/items/bell.md',
    keywords: ['铜铃', '旧约'],
    body: '铜铃是旧约信物，第一次出现时被交给沈泊。',
    frontmatter: {},
    currentState: {
      holder: '沈泊',
    },
  }

  it('pins matching codex entries beside pairwise review samples', () => {
    const packets = buildL0PinnedAuditPackets({
      project: '审计测试',
      criteria: [
        {
          id: 'callback-bell',
          description: 'Recall the bell.',
          category: 'callback',
          containsAny: ['铜铃'],
        },
      ],
      codexEntries: [codexEntry],
      rows: [
        {
          runId: 'run-1',
          chapterId: 'chapter-002',
          repeatIndex: 1,
          pair: 'baseline:four-layer',
          order: 'candidate-right',
          leftArm: 'baseline',
          rightArm: 'four-layer',
          leftSample: '左样本',
          rightSample: '右样本',
        },
      ],
    })

    expect(packets).toHaveLength(1)
    expect(packets[0]).toMatchObject({
      packetId: 'run-1:baseline:four-layer:candidate-right',
      project: '审计测试',
      needleMappingCoverage: {
        totalCriteria: 1,
        mappedCriteria: 1,
        unmappedCriteria: 0,
        ratio: 1,
      },
    })
    expect(packets[0].needles[0].codexEntries[0]).toMatchObject({
      id: 'item-bell',
      name: '铜铃',
      establishedChapterId: 'unknown',
      matchedTerms: ['铜铃'],
      currentState: {
        holder: '沈泊',
      },
    })
  })

  it('builds judge prompts from the same pinned L0 facts', () => {
    const [packet] = buildL0PinnedAuditPackets({
      project: '审计测试',
      criteria: [
        {
          id: 'callback-bell',
          description: 'Recall the bell.',
          category: 'callback',
          containsAny: ['铜铃'],
        },
      ],
      codexEntries: [codexEntry],
      rows: [
        {
          runId: 'run-1',
          chapterId: 'chapter-002',
          repeatIndex: 1,
          pair: 'baseline:four-layer',
          order: 'candidate-right',
          leftArm: 'baseline',
          rightArm: 'four-layer',
          leftSample: '左样本',
          rightSample: '右样本',
        },
      ],
    })

    const prompt = buildAuditPinnedJudgePrompt({ packet })

    expect(prompt).toContain('L0 codex 钉屏事实')
    expect(prompt).toContain('codex=item-bell')
    expect(prompt).toContain('state={"holder":"沈泊"}')
    expect(prompt).toContain('"needle_status"')
    expect(prompt).toContain('"choice":"A|B|tie"')
  })

  it('marks criteria as unmapped instead of guessing missing L0 facts', () => {
    const packets = buildL0PinnedAuditPackets({
      criteria: [
        {
          id: 'callback-missing',
          description: 'Recall the missing token.',
          category: 'callback',
          contains: ['不存在的设定'],
        },
      ],
      codexEntries: [codexEntry],
      rows: [
        {
          runId: 'run-1',
          repeatIndex: 1,
          pair: 'baseline:four-layer',
          order: 'candidate-left',
          leftArm: 'four-layer',
          rightArm: 'baseline',
          leftSample: '左样本',
          rightSample: '右样本',
        },
      ],
    })

    expect(packets[0].needleMappingCoverage).toMatchObject({
      totalCriteria: 1,
      mappedCriteria: 0,
      unmappedCriteria: 1,
      ratio: 0,
      unmappedCriterionIds: ['callback-missing'],
    })
    expect(packets[0].needles[0]).toMatchObject({
      status: 'unmapped',
      reason: 'no L0 codex entry matched criterion terms',
      codexEntries: [],
    })
  })
})
