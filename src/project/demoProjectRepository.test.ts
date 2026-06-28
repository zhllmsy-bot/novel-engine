import { describe, expect, it } from 'vitest'
import { loadDemoProject } from './demoProjectRepository'

describe('demo project repository', () => {
  it('loads the open Markdown/YAML project as editor data', () => {
    const project = loadDemoProject()

    expect(project.title).toBe('玄铁剑鸣')
    expect(project.sourceOfTruth).toBe('markdown')
    expect(project.chapters[0]).toMatchObject({
      id: 'chapter-001',
      title: '第001章 山门雨',
      path: 'manuscript/volume-001/chapter-001.md',
    })
    expect(project.chapters[0].content).toContain('沈微第一次听见玄铁剑的声音')
    expect(project.codexEntries[0]).toMatchObject({
      name: '李长老',
      path: 'codex/characters/li-zhanglao.md',
      currentState: {
        修为: '金丹期',
      },
    })
  })
})
