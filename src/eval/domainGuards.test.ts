import { describe, expect, it } from 'vitest'
import {
  codexViolationGuard,
  entityHallucinationGuard,
  futureLeakGuard,
} from './domainGuards'
import type { CodexEntry, ProjectChapter } from '../project/projectTypes'

const currentChapter: ProjectChapter = {
  id: 'chapter-001',
  title: '第一章',
  status: '编辑中',
  path: 'manuscript/chapter-001.md',
  order: 1,
  content: '沈泊握着镜湖钥。',
  wordCount: 8,
}
const futureChapter: ProjectChapter = {
  id: 'chapter-002',
  title: '第二章',
  status: '已摘要',
  path: 'manuscript/chapter-002.md',
  order: 2,
  content: '旧封印松动是未来答案。',
  wordCount: 10,
}
const codexEntry: CodexEntry = {
  id: 'item-key',
  name: '镜湖钥',
  type: 'item',
  path: 'codex/items/key.md',
  keywords: ['镜湖钥', '黑潮司'],
  body: '镜湖钥不能交给黑潮司。',
  frontmatter: {},
  currentState: {},
}
const characterEntry: CodexEntry = {
  id: 'character-shenbo',
  name: '沈泊',
  type: 'character',
  path: 'codex/characters/shenbo.md',
  keywords: ['沈泊'],
  body: '守灯人。',
  frontmatter: {},
  currentState: {},
}

describe('domain guards', () => {
  it('detects future-only leaked terms from future chapters and criteria', () => {
    const result = futureLeakGuard({
      output: '旧封印松动。',
      currentChapter,
      chapters: [currentChapter, futureChapter],
      codexEntries: [],
      knownFutureTerms: ['旧封印松动'],
      criteria: [
        {
          id: 'future',
          description: 'No future answer.',
          category: 'future_leak',
          notContains: ['未来答案'],
        },
      ],
    })

    expect(result.pass).toBe(false)
    expect(result.matches).toContain('旧封印松动')
  })

  it('detects configured setting contradictions', () => {
    const result = codexViolationGuard({
      output: '沈泊把镜湖钥交给黑潮司。',
      criteria: [
        {
          id: 'setting',
          description: 'No key handoff.',
          category: 'setting',
          notContains: ['交给黑潮司'],
        },
      ],
    })

    expect(result.pass).toBe(false)
    expect(result.matches).toEqual(['交给黑潮司'])
  })

  it('flags unknown prominent entities while allowing codex entities', () => {
    const result = entityHallucinationGuard({
      output: '镜湖钥和玄霜宗同时出现。',
      codexEntries: [codexEntry, characterEntry],
    })

    expect(result.pass).toBe(false)
    expect(result.matches).toContain('玄霜宗')
    expect(result.matches).not.toContain('镜湖钥')
  })

  it('does not flag narrative clauses as hallucinated entities', () => {
    const result = entityHallucinationGuard({
      output:
        '这把钥不是黑潮司的。沈泊把镜湖钥握得更紧，只说自己不会失约。',
      codexEntries: [codexEntry, characterEntry],
    })

    expect(result.pass).toBe(true)
    expect(result.matches).toEqual([])
  })
})
