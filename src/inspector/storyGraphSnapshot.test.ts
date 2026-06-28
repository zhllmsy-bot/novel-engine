import { describe, expect, it } from 'vitest'

import { buildStoryGraph } from './storyGraph'
import {
  buildStoryGraphSnapshot,
  getStoryGraphSnapshotContentKey,
  parseStoryGraphSnapshot,
  storyGraphSnapshotPath,
  storyGraphSnapshotVersion,
} from './storyGraphSnapshot'
import type { NarrativeMemoryPlan } from '@/memory/memoryContextBuilder'
import type { ProjectChapter } from '@/project/projectTypes'

const chapter: ProjectChapter = {
  id: 'chapter-001',
  title: '第001章 山门雨',
  status: '编辑中',
  path: 'manuscript/volume-001/chapter-001.md',
  order: 1,
  storyTime: {
    label: '玄历三百二十一年·春夜',
    sortKey: 321.1,
  },
  content: '沈微见到了李长老。',
  wordCount: 10,
}

const memoryPlan: NarrativeMemoryPlan = {
  memories: [
    {
      layer: 'L2 风格',
      body: '当前章原文',
      source: 'manuscript/volume-001/chapter-001.md',
    },
  ],
  audit: {
    budgetChars: 900,
    usedChars: 10,
    droppedCount: 0,
    layerSummaries: [],
    entries: [],
  },
}

describe('story graph snapshot', () => {
  it('builds a stable rebuildable graph snapshot contract', () => {
    const graph = buildStoryGraph({
      activeChapter: chapter,
      runtimeMemoryPlan: memoryPlan,
      codexEntries: [],
      plotThreads: [],
    })

    const snapshot = buildStoryGraphSnapshot({
      graph,
      generatedAt: '2026-01-01T00:00:00.000Z',
      projectTitle: '玄铁剑鸣',
      activeChapterId: chapter.id,
      activeChapterTitle: chapter.title,
      selectedNodeId: `chapter:${chapter.id}`,
    })

    expect(storyGraphSnapshotPath).toBe('.novel/graph.json')
    expect(snapshot).toMatchObject({
      version: storyGraphSnapshotVersion,
      generatedAt: '2026-01-01T00:00:00.000Z',
      source: {
        projectTitle: '玄铁剑鸣',
        activeChapterId: 'chapter-001',
        activeChapterTitle: '第001章 山门雨',
      },
      viewState: {
        selectedNodeId: 'chapter:chapter-001',
        collapsedNodeIds: [],
      },
    })
    expect(snapshot.graph.nodes[0]).toEqual(
      expect.objectContaining({
        id: 'chapter:chapter-001',
        kind: 'chapter',
        label: '第001章 山门雨',
        position: { x: 246, y: 176 },
      }),
    )
    expect(snapshot.graph.nodes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'story_time:chapter-001',
          kind: 'story_time',
          label: '玄历三百二十一年·春夜',
        }),
      ]),
    )
    expect(snapshot.graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: 'story_time:chapter-001',
          to: 'chapter:chapter-001',
          label: '故事时间',
        }),
      ]),
    )
    expect(snapshot.graph.edges).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          from: expect.stringContaining('memory:'),
          to: 'chapter:chapter-001',
          label: '注入',
        }),
      ]),
    )
  })

  it('round-trips through JSON parsing', () => {
    const graph = buildStoryGraph({
      activeChapter: chapter,
      runtimeMemoryPlan: memoryPlan,
      codexEntries: [],
      plotThreads: [],
    })
    const snapshot = buildStoryGraphSnapshot({
      graph,
      generatedAt: '2026-01-01T00:00:00.000Z',
    })

    expect(parseStoryGraphSnapshot(JSON.parse(JSON.stringify(snapshot)))).toEqual(
      snapshot,
    )
  })

  it('ignores generated timestamps when computing content keys', () => {
    const graph = buildStoryGraph({
      activeChapter: chapter,
      runtimeMemoryPlan: memoryPlan,
      codexEntries: [],
      plotThreads: [],
    })
    const firstSnapshot = buildStoryGraphSnapshot({
      graph,
      generatedAt: '2026-01-01T00:00:00.000Z',
      selectedNodeId: `chapter:${chapter.id}`,
    })
    const secondSnapshot = buildStoryGraphSnapshot({
      graph,
      generatedAt: '2026-01-01T00:05:00.000Z',
      selectedNodeId: `chapter:${chapter.id}`,
    })

    expect(getStoryGraphSnapshotContentKey(firstSnapshot)).toEqual(
      getStoryGraphSnapshotContentKey(secondSnapshot),
    )
  })

  it('rejects incompatible snapshot shapes', () => {
    expect(() =>
      parseStoryGraphSnapshot({
        version: 999,
        generatedAt: '2026-01-01T00:00:00.000Z',
        source: {},
        graph: { nodes: [], edges: [] },
        viewState: { collapsedNodeIds: [] },
      }),
    ).toThrow()

    expect(() =>
      parseStoryGraphSnapshot({
        version: storyGraphSnapshotVersion,
        generatedAt: '2026-01-01T00:00:00.000Z',
        source: {},
        graph: {
          nodes: [
            {
              id: 'unknown:1',
              kind: 'unknown',
              label: 'Unknown',
              detail: '',
              position: { x: 0, y: 0 },
            },
          ],
          edges: [],
        },
        viewState: { collapsedNodeIds: [] },
      }),
    ).toThrow()
  })
})
