import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  loadChaptersFromDir,
  parseChapterNumber,
  parseMarkdownChapter,
} from './chapterParser.ts'

describe('publisher chapter parser', () => {
  it('parses Chinese and numeric chapter numbers', () => {
    expect(parseChapterNumber('十二')).toBe(12)
    expect(parseChapterNumber('一百零二')).toBe(102)
    expect(parseChapterNumber('003')).toBe(3)
  })

  it('extracts title, content, and word count from markdown', () => {
    const chapter = parseMarkdownChapter(
      `---
draft: true
---
# 第十二章 玄铁剑出鞘

第一段。

第二段。
<!-- editor note -->
`,
      '/novel/chapter-012.md',
    )

    expect(chapter.number).toBe(12)
    expect(chapter.title).toBe('玄铁剑出鞘')
    expect(chapter.content).toBe('第一段。\n\n第二段。')
    expect(chapter.wordCount).toBe(8)
  })

  it('loads markdown chapters sorted by chapter number', async () => {
    const root = await mkdtemp(join(tmpdir(), 'publisher-chapters-'))
    const chaptersDir = join(root, 'manuscript')
    await mkdir(chaptersDir)

    await writeFile(join(chaptersDir, 'chapter-002.md'), '# 第2章 第二章\n\n乙')
    await writeFile(join(chaptersDir, 'chapter-001.md'), '# 第1章 第一章\n\n甲')

    try {
      const chapters = await loadChaptersFromDir(chaptersDir)
      expect(chapters.map((chapter) => chapter.number)).toEqual([1, 2])
      expect(chapters.map((chapter) => chapter.title)).toEqual([
        '第一章',
        '第二章',
      ])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
