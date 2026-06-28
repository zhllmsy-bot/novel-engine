import type { ChapterListItem } from '../types/domain'

export type ProjectChapter = ChapterListItem & {
  path: string
  filePath?: string
  order: number
  storyTime?: ChapterStoryTime
  sceneDefIds?: string[]
  content: string
  wordCount: number
}

export type ChapterStoryTime = {
  label?: string
  sortKey?: number
}

export type CodexEntry = {
  id: string
  name: string
  type: CodexEntryType
  path: string
  keywords: string[]
  body: string
  frontmatter: Record<string, unknown>
  currentState: Record<string, string>
}

export type CodexEntryType =
  | 'character'
  | 'scene_def'
  | 'world'
  | 'item'
  | 'faction'
  | 'rule'
  | 'note'
  | (string & {})

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
