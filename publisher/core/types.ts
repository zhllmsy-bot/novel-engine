export type PublishChapterPayload = {
  id: string
  number: number
  title: string
  content: string
  sourcePath: string
  wordCount: number
}

export type PublishResultStatus =
  | 'success'
  | 'skipped'
  | 'daily_limit'
  | 'error'

export type PublishResult = {
  status: PublishResultStatus
  message: string
  remoteId?: string
}

export type PublisherAdapter = {
  id: string
  displayName: string
  publishChapter(payload: PublishChapterPayload): Promise<PublishResult>
}

export type PublishRunOptions = {
  chaptersDir: string
  progressPath: string
  adapter: PublisherAdapter
  startFrom?: number
  limit?: number
  recordSuccess?: boolean
}

export type PublishRunReport = {
  adapterId: string
  scanned: number
  skipped: number
  attempted: number
  succeeded: number
  failed: number
  results: Array<{
    chapter: PublishChapterPayload
    result: PublishResult
  }>
}

export type PublishProgressRecord = {
  chapterNumber: number
  title?: string
  sourcePath?: string
  wordCount?: number
  status: PublishResultStatus
  message: string
  remoteId?: string
  updatedAt: string
}
