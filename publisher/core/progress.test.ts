import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ProgressStore } from './progress.ts'

describe('publisher progress store', () => {
  it('loads legacy published_chapters files', async () => {
    const root = await mkdtemp(join(tmpdir(), 'publisher-progress-'))
    const progressPath = join(root, 'progress.json')
    await writeFile(
      progressPath,
      JSON.stringify({
        published_chapters: [1, '2'],
        last_updated: null,
      }),
    )

    try {
      const progress = new ProgressStore(progressPath)

      expect(await progress.loadPublished()).toEqual(new Set([1, 2]))
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('records publish result details while keeping published_chapters', async () => {
    const root = await mkdtemp(join(tmpdir(), 'publisher-progress-'))
    const progressPath = join(root, 'progress.json')

    try {
      const progress = new ProgressStore(progressPath)
      await progress.recordResult(
        {
          id: 'chapter-1',
          number: 1,
          title: '山门雨',
          content: '正文',
          sourcePath: 'manuscript/chapter-001.md',
          wordCount: 2,
        },
        {
          status: 'success',
          message: 'published',
          remoteId: 'remote-1',
        },
      )

      const progressJson = JSON.parse(await readFile(progressPath, 'utf8')) as {
        version: number
        published_chapters: number[]
        chapters: Record<
          string,
          {
            title: string
            status: string
            message: string
            remoteId: string
          }
        >
      }

      expect(progressJson.version).toBe(1)
      expect(progressJson.published_chapters).toEqual([1])
      expect(progressJson.chapters['1']).toMatchObject({
        title: '山门雨',
        status: 'success',
        message: 'published',
        remoteId: 'remote-1',
      })
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('does not treat failed records as published', async () => {
    const root = await mkdtemp(join(tmpdir(), 'publisher-progress-'))
    const progressPath = join(root, 'progress.json')

    try {
      const progress = new ProgressStore(progressPath)
      await progress.addPublished(1)
      await progress.recordResult(
        {
          id: 'chapter-1',
          number: 1,
          title: '山门雨',
          content: '正文',
          sourcePath: 'manuscript/chapter-001.md',
          wordCount: 2,
        },
        {
          status: 'error',
          message: 'platform rejected',
        },
      )

      expect(await progress.loadPublished()).toEqual(new Set())
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('lets detailed failed records override legacy published entries', async () => {
    const root = await mkdtemp(join(tmpdir(), 'publisher-progress-'))
    const progressPath = join(root, 'progress.json')
    await writeFile(
      progressPath,
      JSON.stringify({
        published_chapters: [1],
        chapters: {
          '1': {
            chapterNumber: 1,
            title: '山门雨',
            status: 'error',
            message: 'platform rejected',
            updatedAt: '2026-01-01T00:00:00.000Z',
          },
        },
      }),
    )

    try {
      const progress = new ProgressStore(progressPath)

      expect(await progress.loadPublished()).toEqual(new Set())
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
