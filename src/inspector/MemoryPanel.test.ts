import { describe, expect, it } from 'vitest'
import { buildMemorySourceSummary } from '@/memory/memorySourceSummary'
import { parseMemorySourceChips } from './memorySourceChips'

describe('memory panel source chips', () => {
  it('labels volume summaries as first-class memory sources', () => {
    expect(
      parseMemorySourceChips(
        'chapter_summary:chapter-001,chapter-002;volume_summary:volume-001;plot_thread:thread-1',
      ),
    ).toEqual([
      { kind: 'chapter_summary', label: '章摘要', detail: 'chapter-001' },
      { kind: 'chapter_summary', label: '章摘要', detail: 'chapter-002' },
      { kind: 'volume_summary', label: '卷摘要', detail: 'volume-001' },
      { kind: 'plot_thread', label: '伏笔', detail: 'thread-1' },
    ])
  })

  it('labels recall and state-log sources for audit scanning', () => {
    expect(
      parseMemorySourceChips(
        'recall:chapter_summary:chapter-001;character_state_log:state-1;meta/project.json',
      ),
    ).toEqual([
      {
        kind: 'recall',
        label: '召回',
        detail: 'chapter_summary:chapter-001',
      },
      { kind: 'character_state_log', label: '状态', detail: 'state-1' },
      {
        kind: 'project',
        label: '项目',
        detail: 'meta/project.json',
      },
    ])
  })

  it('labels plain manuscript and codex paths with shared source families', () => {
    expect(
      parseMemorySourceChips(
        'manuscript/volume-001/chapter-001.md,codex/characters/li-zhanglao.md',
      ),
    ).toEqual([
      {
        kind: 'manuscript',
        label: '正文',
        detail: 'manuscript/volume-001/chapter-001.md',
      },
      {
        kind: 'codex',
        label: '设定',
        detail: 'codex/characters/li-zhanglao.md',
      },
    ])
  })

  it('summarizes selected memory sources by inspectable source family', () => {
    expect(
      buildMemorySourceSummary([
        {
          layer: 'L2 风格',
          body: '近期正文',
          source:
            'manuscript/volume-001/chapter-002.md,manuscript/volume-001/chapter-001.md',
        },
        {
          layer: 'L0 事实',
          body: '人物卡',
          source: 'codex/characters/li-zhanglao.md',
        },
        {
          layer: 'L3 意图',
          body: '召回',
          source:
            'recall:chapter_summary:chapter-001;recall:plot_thread:thread-1',
        },
        {
          layer: 'L1 剧情',
          body: '摘要和伏笔',
          source:
            'chapter_summary:chapter-001,chapter-002;plot_thread:thread-1',
        },
      ]),
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          family: 'manuscript',
          label: '正文',
          memoryCount: 1,
          sourceCount: 2,
          selectedChars: '近期正文'.length,
          sources: [
            'manuscript/volume-001/chapter-002.md',
            'manuscript/volume-001/chapter-001.md',
          ],
        }),
        expect.objectContaining({
          family: 'codex',
          label: '设定',
          memoryCount: 1,
          sources: ['codex/characters/li-zhanglao.md'],
        }),
        expect.objectContaining({
          family: 'chapter_summary',
          label: '章摘要',
          memoryCount: 1,
          sourceCount: 2,
          sources: [
            'chapter_summary:chapter-001',
            'chapter_summary:chapter-002',
          ],
        }),
        expect.objectContaining({
          family: 'plot_thread',
          label: '伏笔',
          memoryCount: 1,
          sources: ['plot_thread:thread-1'],
        }),
        expect.objectContaining({
          family: 'recall',
          label: '召回',
          memoryCount: 1,
          sourceCount: 2,
          sources: [
            'recall:chapter_summary:chapter-001',
            'recall:plot_thread:thread-1',
          ],
        }),
      ]),
    )
  })
})
