import { loadChaptersFromDir } from './chapterParser.ts'
import { ProgressStore } from './progress.ts'
import type { PublishRunOptions, PublishRunReport } from './types.ts'

export async function runPublishPlan(
  options: PublishRunOptions,
): Promise<PublishRunReport> {
  const progress = new ProgressStore(options.progressPath)
  const published = await progress.loadPublished()
  const chapters = await loadChaptersFromDir(
    options.chaptersDir,
    options.startFrom || 1,
  )
  const pending = chapters.filter((chapter) => !published.has(chapter.number))
  const toPublish = options.limit ? pending.slice(0, options.limit) : pending
  const report: PublishRunReport = {
    adapterId: options.adapter.id,
    scanned: chapters.length,
    skipped: chapters.length - pending.length,
    attempted: 0,
    succeeded: 0,
    failed: 0,
    results: [],
  }

  for (const chapter of toPublish) {
    const result = await options.adapter.publishChapter(chapter)
    report.attempted += 1
    report.results.push({ chapter, result })

    if (options.recordSuccess) {
      await progress.recordResult(chapter, result)
    }

    if (result.status === 'success') {
      report.succeeded += 1
      continue
    }

    if (result.status === 'daily_limit' || result.status === 'error') {
      report.failed += 1
      break
    }
  }

  return report
}
