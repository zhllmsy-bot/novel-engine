import { describe, expect, it } from 'vitest'
import { loadProjectFromFiles } from './projectFileLoader'

describe('project file loader', () => {
  it('builds a project from manifest, Markdown chapters, and codex files', () => {
    const project = loadProjectFromFiles({
      rootPath: '/novels/demo',
      manifestSource: JSON.stringify({
        title: '本地小说',
        source_of_truth: 'markdown',
        chapters: [
          {
            id: 'chapter-002',
            title: '第二章',
            path: 'manuscript/chapter-002.md',
            order: 2,
          },
          {
            id: 'chapter-001',
            title: '第一章',
            path: 'manuscript/chapter-001.md',
            order: 1,
            story_time: {
              label: '倒叙第一夜',
              sort_key: 10.1,
            },
            scene_def_ids: ['scene-rain-gate'],
          },
        ],
      }),
      chapterFiles: [
        {
          path: 'manuscript/chapter-001.md',
          filePath: '/novels/demo/manuscript/chapter-001.md',
          content: '# 第一章\n\n正文一。',
        },
        {
          path: 'manuscript/chapter-002.md',
          filePath: '/novels/demo/manuscript/chapter-002.md',
          content: '# 第二章\n\n正文二。',
        },
      ],
      codexFiles: [
        {
          path: 'codex/locations/rain-gate.md',
          content: `---
id: scene-rain-gate
name: 雨中山门
type: scene_def
keywords: [雨中山门, 山门]
---

地点设定。
`,
        },
        {
          path: 'codex/characters/li.md',
          content: `---
id: char-li
name: 李长老
type: character
keywords: [李长老]
current_state:
  location: 戒律堂
  power_level: 金丹期
---

人物设定。
`,
        },
      ],
    })

    expect(project.rootPath).toBe('/novels/demo')
    expect(project.chapters.map((chapter) => chapter.id)).toEqual([
      'chapter-001',
      'chapter-002',
    ])
    expect(project.chapters[0]).toMatchObject({
      path: 'manuscript/chapter-001.md',
      filePath: '/novels/demo/manuscript/chapter-001.md',
      status: '编辑中',
      title: '第一章',
      storyTime: {
        label: '倒叙第一夜',
        sortKey: 10.1,
      },
      sceneDefIds: ['scene-rain-gate'],
    })
    expect(project.codexEntries.find((entry) => entry.id === 'scene-rain-gate'))
      .toMatchObject({
        name: '雨中山门',
        type: 'scene_def',
        path: 'codex/locations/rain-gate.md',
      })
    expect(project.codexEntries[0]).toMatchObject({
      id: 'scene-rain-gate',
    })
    expect(project.codexEntries[1]).toMatchObject({
      id: 'char-li',
      name: '李长老',
      path: 'codex/characters/li.md',
      keywords: ['李长老'],
      currentState: {
        location: '戒律堂',
        power_level: '金丹期',
      },
    })
  })

  it('extracts character current state from a Markdown section when frontmatter is absent', () => {
    const project = loadProjectFromFiles({
      manifestSource: JSON.stringify({
        title: '状态小节测试',
        source_of_truth: 'markdown',
        chapters: [],
      }),
      chapterFiles: [],
      codexFiles: [
        {
          path: 'codex/characters/jianli.md',
          content: `---
id: character-jianli
name: 简璃
type: character
keywords: [简璃]
---

简璃是镜湖守灯人。

## 当前状态

- 身份: 镜湖守灯人
- 目标: 确认沈泊是否仍遵守青灯誓
- 风险: 被黑潮司追捕

## 背景

她曾在废庙交出镜湖钥。
`,
        },
      ],
    })

    expect(project.codexEntries[0].currentState).toEqual({
      身份: '镜湖守灯人',
      目标: '确认沈泊是否仍遵守青灯誓',
      风险: '被黑潮司追捕',
    })
  })
})
