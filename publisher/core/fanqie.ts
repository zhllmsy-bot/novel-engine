import { resolve } from 'node:path'
import { resolveEnvPath, type EnvMap } from './env.ts'

export type FanqiePublisherConfig = {
  bookId: string
  chaptersDir: string
  progressPath: string
  intervalSeconds: number
  dryRun: boolean
}

export function createFanqieConfig(
  env: EnvMap,
  envFilePath: string,
): FanqiePublisherConfig {
  const sourceUrl =
    env.xiaoshuo_menu || 'https://fanqienovel.com/main/writer/book-manage'
  const chaptersDir = env.wenzhang_menu
    ? resolveEnvPath(env.wenzhang_menu, envFilePath)
    : resolve('examples/demo-novel/manuscript/volume-001')
  const progressPath = env.PUBLISH_PROGRESS_PATH
    ? resolveEnvPath(env.PUBLISH_PROGRESS_PATH, envFilePath)
    : resolveEnvPath('../../../.novel/publisher-progress.json', envFilePath)

  return {
    bookId: extractFanqieBookId(sourceUrl),
    chaptersDir,
    progressPath,
    intervalSeconds: Number(env.PUBLISH_INTERVAL_SECONDS || 5),
    dryRun: env.PUBLISH_DRY_RUN !== '0',
  }
}

export function extractFanqieBookId(url: string): string {
  const chapterManageMatch = url.match(/\/chapter-manage\/(\d+)/)
  if (chapterManageMatch) {
    return chapterManageMatch[1]
  }

  const numericPathPart = new URL(url).pathname
    .split('/')
    .find((part) => /^\d+$/.test(part))

  if (!numericPathPart) {
    throw new Error(`Cannot extract Fanqie book id from URL: ${url}`)
  }

  return numericPathPart
}
