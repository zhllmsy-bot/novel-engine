import { describe, expect, it } from 'vitest'
import { parseMarkdownAsset } from './markdownProject'

describe('markdown project parser', () => {
  it('parses YAML frontmatter and keeps markdown body as the editable source', () => {
    const parsed = parseMarkdownAsset(
      `---
id: char-li
name: 李长老
keywords: [李长老, 玄铁剑]
---

# 人物卡

玄天宗戒律堂长老。
`,
      'fallback',
    )

    expect(parsed.title).toBe('人物卡')
    expect(parsed.frontmatter.name).toBe('李长老')
    expect(parsed.body).toContain('玄天宗戒律堂长老')
    expect(parsed.wordCount).toBeGreaterThan(0)
  })

  it('uses frontmatter name when a markdown heading is absent', () => {
    const parsed = parseMarkdownAsset(
      `---
name: 玄铁剑
---

剑身有裂纹。
`,
      'fallback',
    )

    expect(parsed.title).toBe('玄铁剑')
  })
})
