import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import type {
  PublishChapterPayload,
  PublishProgressRecord,
  PublishResult,
} from './types.ts'

type ProgressFile = {
  version?: number
  published_chapters?: Array<number | string>
  chapters?: Record<string, PublishProgressRecord>
  last_updated?: string | null
}

export class ProgressStore {
  readonly path: string

  constructor(path: string) {
    this.path = path
  }

  async loadPublished(): Promise<Set<number>> {
    const data = await this.load()
    return this.publishedFromData(data)
  }

  async isPublished(chapterNumber: number): Promise<boolean> {
    return (await this.loadPublished()).has(chapterNumber)
  }

  async addPublished(chapterNumber: number): Promise<void> {
    await this.recordResult(
      {
        id: String(chapterNumber),
        number: chapterNumber,
        title: `Chapter ${chapterNumber}`,
        content: '',
        sourcePath: '',
        wordCount: 0,
      },
      {
        status: 'success',
        message: 'Published',
      },
    )
  }

  async recordResult(
    chapter: PublishChapterPayload,
    result: PublishResult,
  ): Promise<void> {
    const data = await this.load()
    const chapters = {
      ...(data.chapters || {}),
      [String(chapter.number)]: {
        chapterNumber: chapter.number,
        title: chapter.title,
        sourcePath: chapter.sourcePath,
        wordCount: chapter.wordCount,
        status: result.status,
        message: result.message,
        remoteId: result.remoteId,
        updatedAt: new Date().toISOString(),
      },
    }
    const published = this.publishedFromData({
      ...data,
      chapters,
    })

    await this.save({
      version: 1,
      published_chapters: [...published].sort((left, right) => left - right),
      chapters,
      last_updated: new Date().toISOString(),
    })
  }

  async reset(): Promise<void> {
    await this.save({
      version: 1,
      published_chapters: [],
      chapters: {},
      last_updated: null,
    })
  }

  private async load(): Promise<ProgressFile> {
    try {
      const source = await readFile(this.path, 'utf8')
      const parsed = JSON.parse(source) as ProgressFile
      return {
        version: parsed.version || 1,
        published_chapters: Array.isArray(parsed.published_chapters)
          ? parsed.published_chapters
          : [],
        chapters: this.normalizeChapters(parsed.chapters),
        last_updated: parsed.last_updated || null,
      }
    } catch {
      return {
        version: 1,
        published_chapters: [],
        chapters: {},
        last_updated: null,
      }
    }
  }

  private publishedFromData(data: ProgressFile): Set<number> {
    const published = new Set(
      (data.published_chapters || [])
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value)),
    )

    for (const record of Object.values(data.chapters || {})) {
      if (record.status === 'success') {
        published.add(record.chapterNumber)
      } else {
        published.delete(record.chapterNumber)
      }
    }

    return published
  }

  private normalizeChapters(
    chapters: ProgressFile['chapters'],
  ): Record<string, PublishProgressRecord> {
    if (!chapters || typeof chapters !== 'object') {
      return {}
    }

    const normalized: Record<string, PublishProgressRecord> = {}
    for (const [key, value] of Object.entries(chapters)) {
      if (!value || typeof value !== 'object') {
        continue
      }

      const chapterNumber = Number(value.chapterNumber)
      if (!Number.isInteger(chapterNumber)) {
        continue
      }

      normalized[key] = {
        chapterNumber,
        title: value.title,
        sourcePath: value.sourcePath,
        wordCount: value.wordCount,
        status: value.status,
        message: value.message,
        remoteId: value.remoteId,
        updatedAt: value.updatedAt,
      }
    }

    return normalized
  }

  private async save(data: ProgressFile): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true })
    const tmpPath = `${this.path}.tmp`
    await writeFile(tmpPath, `${JSON.stringify(data, null, 2)}\n`, 'utf8')
    await rename(tmpPath, this.path)
  }
}
