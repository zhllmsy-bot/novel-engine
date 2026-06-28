import type { ChapterListItem } from '../types/domain'

export type ProjectChapter = ChapterListItem & {
  path: string
  filePath?: string
  order: number
  content: string
  wordCount: number
}

export type CodexEntry = {
  id: string
  name: string
  type: string
  path: string
  keywords: string[]
  body: string
  frontmatter: Record<string, unknown>
}

export type NovelProject = {
  title: string
  sourceOfTruth: 'markdown'
  rootPath?: string
  chapters: ProjectChapter[]
  codexEntries: CodexEntry[]
}

export type ProjectRepository = {
  loadProject(): Promise<NovelProject>
}
