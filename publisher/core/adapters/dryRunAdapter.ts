import type {
  PublisherAdapter,
  PublishChapterPayload,
  PublishResult,
} from '../types.ts'

export function createDryRunAdapter(): PublisherAdapter {
  return {
    id: 'dry-run',
    displayName: 'Dry Run Publisher',
    async publishChapter(payload: PublishChapterPayload): Promise<PublishResult> {
      return {
        status: 'success',
        message: `Dry run accepted chapter ${payload.number}: ${payload.title} (${payload.wordCount} chars)`,
        remoteId: `dry-run:${payload.number}`,
      }
    },
  }
}
