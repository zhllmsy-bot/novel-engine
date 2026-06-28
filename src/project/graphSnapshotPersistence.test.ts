import { describe, expect, it, vi } from 'vitest'

import { buildStoryGraph } from '@/inspector/storyGraph'
import { buildStoryGraphSnapshot } from '@/inspector/storyGraphSnapshot'
import type { NarrativeMemoryPlan } from '@/memory/memoryContextBuilder'
import type { ProjectChapter } from '@/project/projectTypes'
import { createGraphSnapshotPersistence } from './graphSnapshotPersistence'

const chapter: ProjectChapter = {
  id: 'chapter-001',
  title: '第001章 山门雨',
  status: '编辑中',
  path: 'manuscript/volume-001/chapter-001.md',
  order: 1,
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

function snapshotFixture() {
  const graph = buildStoryGraph({
    activeChapter: chapter,
    runtimeMemoryPlan: memoryPlan,
    codexEntries: [],
    plotThreads: [],
  })

  return buildStoryGraphSnapshot({
    graph,
    generatedAt: '2026-01-01T00:00:00.000Z',
    selectedNodeId: `chapter:${chapter.id}`,
  })
}

describe('graph snapshot persistence', () => {
  it('is a no-op outside Tauri', async () => {
    const readSnapshot = vi.fn()
    const writeSnapshot = vi.fn()
    const persistence = createGraphSnapshotPersistence({
      detector: { isTauri: () => false },
      readSnapshot,
      writeSnapshot,
    })

    await expect(persistence.loadGraphSnapshot('/project')).resolves.toBeNull()
    await expect(
      persistence.saveGraphSnapshot('/project', snapshotFixture()),
    ).resolves.toBeUndefined()

    expect(readSnapshot).not.toHaveBeenCalled()
    expect(writeSnapshot).not.toHaveBeenCalled()
  })

  it('writes validated graph snapshots as pretty JSON in Tauri', async () => {
    const writeSnapshot = vi.fn().mockResolvedValue(undefined)
    const persistence = createGraphSnapshotPersistence({
      detector: { isTauri: () => true },
      readSnapshot: vi.fn(),
      writeSnapshot,
    })
    const snapshot = snapshotFixture()

    await persistence.saveGraphSnapshot('/project', snapshot)

    expect(writeSnapshot).toHaveBeenCalledWith(
      '/project',
      JSON.stringify(snapshot, null, 2),
    )
  })

  it('loads and validates graph snapshots from Tauri', async () => {
    const snapshot = snapshotFixture()
    const persistence = createGraphSnapshotPersistence({
      detector: { isTauri: () => true },
      readSnapshot: vi.fn().mockResolvedValue(JSON.stringify(snapshot)),
      writeSnapshot: vi.fn(),
    })

    await expect(persistence.loadGraphSnapshot('/project')).resolves.toEqual(
      snapshot,
    )
  })
})
