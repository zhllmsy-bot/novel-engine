import { describe, expect, it, vi } from 'vitest'
import { loadTauriProject } from './tauriProjectRepository'

describe('tauri project repository', () => {
  it('loads a desktop project while keeping display paths separate from write paths', async () => {
    const project = await loadTauriProject('/novels/demo', {
      readManifest: vi.fn().mockResolvedValue(
        JSON.stringify({
          title: '桌面项目',
          source_of_truth: 'markdown',
          chapters: [
            {
              id: 'chapter-001',
              title: '第一章',
              path: 'manuscript/chapter-001.md',
              order: 1,
            },
          ],
        }),
      ),
      scanChapters: vi.fn().mockResolvedValue([
        {
          id: 'chapter-001',
          title: '第一章',
          file_path: '/novels/demo/manuscript/chapter-001.md',
          content_hash: 'abc',
          word_count: 3,
        },
      ]),
      scanCodex: vi.fn().mockResolvedValue([
        {
          file_path: 'codex/characters/li.md',
          content: `---
name: 李长老
keywords: [李长老]
---

设定。
`,
        },
      ]),
      readChapter: vi.fn().mockResolvedValue('# 第一章\n\n正文。'),
    })

    expect(project.rootPath).toBe('/novels/demo')
    expect(project.chapters[0]).toMatchObject({
      path: 'manuscript/chapter-001.md',
      filePath: '/novels/demo/manuscript/chapter-001.md',
      content: '# 第一章\n\n正文。',
    })
    expect(project.codexEntries[0]).toMatchObject({
      path: 'codex/characters/li.md',
      name: '李长老',
    })
  })
})
