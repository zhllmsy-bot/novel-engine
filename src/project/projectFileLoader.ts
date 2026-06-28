import type { ChapterStatus } from '../types/domain'
import {
  parseMarkdownAsset,
  stringArrayField,
  stringField,
} from './markdownProject.ts'
import type { CodexEntry, NovelProject, ProjectChapter } from './projectTypes'

export type RawProjectManifest = {
  title?: string
  source_of_truth?: string
  chapters?: Array<{
    id?: string
    title?: string
    path?: string
    order?: number
    story_time?: {
      label?: unknown
      sort_key?: unknown
    }
    scene_def_ids?: unknown
  }>
}

export type MarkdownFileSource = {
  path: string
  filePath?: string
  content: string
}

export type LoadProjectFromFilesInput = {
  rootPath?: string
  manifestSource: string
  chapterFiles: MarkdownFileSource[]
  codexFiles: MarkdownFileSource[]
}

export function loadProjectFromFiles(
  input: LoadProjectFromFilesInput,
): NovelProject {
  const rawProject = JSON.parse(input.manifestSource) as RawProjectManifest

  return {
    title: rawProject.title || 'Untitled Novel',
    sourceOfTruth: 'markdown',
    rootPath: input.rootPath,
    chapters: loadChapters(rawProject, input.chapterFiles),
    codexEntries: loadCodexEntries(input.codexFiles),
  }
}

function loadChapters(
  rawProject: RawProjectManifest,
  chapterFiles: MarkdownFileSource[],
): ProjectChapter[] {
  const filesByPath = new Map(
    chapterFiles.map((file) => [normalizePath(file.path), file]),
  )
  const manifestChapters = rawProject.chapters || []

  if (manifestChapters.length > 0) {
    return manifestChapters
      .map((chapter, index) => {
        const path = normalizePath(chapter.path || '')
        const file = filesByPath.get(path)

        return chapterFromSource({
          id: chapter.id || fileStem(path) || `chapter-${index + 1}`,
          title: chapter.title || chapter.id || `chapter-${index + 1}`,
          path,
          filePath: file?.filePath,
          order: chapter.order || index + 1,
          storyTime: parseChapterStoryTime(chapter.story_time),
          sceneDefIds: stringArrayField(chapter.scene_def_ids),
          content: file?.content || '',
          status: '已摘要',
        })
      })
      .sort((left, right) => left.order - right.order)
      .map((chapter, index) => ({
        ...chapter,
        status: index === 0 ? '编辑中' : '已摘要',
      }))
  }

  return chapterFiles
    .map((file, index) =>
      chapterFromSource({
        id: fileStem(file.path) || `chapter-${index + 1}`,
        title: fileStem(file.path) || `chapter-${index + 1}`,
        path: normalizePath(file.path),
        filePath: file.filePath,
        order: index + 1,
        sceneDefIds: [],
        content: file.content,
        status: '已摘要',
      }),
    )
    .sort((left, right) => left.order - right.order)
    .map((chapter, index) => ({
      ...chapter,
      status: index === 0 ? '编辑中' : '已摘要',
    }))
}

function chapterFromSource(input: {
  id: string
  title: string
  path: string
  filePath?: string
  order: number
  storyTime?: ProjectChapter['storyTime']
  sceneDefIds?: string[]
  content: string
  status: ChapterStatus
}): ProjectChapter {
  const parsed = parseMarkdownAsset(input.content, input.title)

  return {
    id: input.id,
    title: parsed.title,
    status: input.status,
    path: input.path,
    filePath: input.filePath,
    order: input.order,
    storyTime: input.storyTime,
    sceneDefIds: input.sceneDefIds || [],
    content: parsed.body,
    wordCount: parsed.wordCount,
  }
}

function parseChapterStoryTime(value: unknown): ProjectChapter['storyTime'] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const record = value as Record<string, unknown>
  const label = stringField(record.label)?.trim()
  const sortKey =
    typeof record.sort_key === 'number' && Number.isFinite(record.sort_key)
      ? record.sort_key
      : undefined

  if (!label && sortKey === undefined) {
    return undefined
  }

  return {
    label,
    sortKey,
  }
}

function loadCodexEntries(codexFiles: MarkdownFileSource[]): CodexEntry[] {
  return codexFiles.map((file) => {
    const path = normalizePath(file.path)
    const parsed = parseMarkdownAsset(file.content, path)
    const id = stringField(parsed.frontmatter.id) || path
    const name = stringField(parsed.frontmatter.name) || parsed.title

    return {
      id,
      name,
      type: stringField(parsed.frontmatter.type) || 'note',
      path,
      keywords: stringArrayField(parsed.frontmatter.keywords),
      body: parsed.body,
      frontmatter: parsed.frontmatter,
      currentState: parseCurrentState(parsed.frontmatter.current_state, parsed.body),
    }
  })
}

function parseCurrentState(
  frontmatterState: unknown,
  body: string,
): Record<string, string> {
  const fromFrontmatter = recordStringFields(frontmatterState)
  if (Object.keys(fromFrontmatter).length > 0) {
    return fromFrontmatter
  }

  return parseCurrentStateSection(body)
}

function recordStringFields(value: unknown): Record<string, string> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(value)
      .map(([key, rawValue]) => [key.trim(), scalarStateValue(rawValue)] as const)
      .filter(([key, rawValue]) => key && rawValue),
  )
}

function scalarStateValue(value: unknown) {
  if (typeof value === 'string') return value.trim()
  if (typeof value === 'number' || typeof value === 'boolean') return String(value)
  return ''
}

function parseCurrentStateSection(body: string): Record<string, string> {
  const lines = body.split('\n')
  const headingIndex = lines.findIndex((line) =>
    /^#{2,6}\s*当前状态\s*$/.test(line.trim()),
  )

  if (headingIndex < 0) {
    return {}
  }

  const stateEntries: Array<[string, string]> = []

  for (const line of lines.slice(headingIndex + 1)) {
    const trimmedLine = line.trim()

    if (/^#{1,6}\s+/.test(trimmedLine)) {
      break
    }

    const match = trimmedLine.match(/^(?:[-*]\s*)?([^:：]+)[:：]\s*(.+)$/)
    if (!match) {
      continue
    }

    const key = match[1].trim()
    const value = match[2].trim()
    if (key && value) {
      stateEntries.push([key, value])
    }
  }

  return Object.fromEntries(stateEntries)
}

function normalizePath(path: string) {
  return path.replace(/\\/g, '/')
}

function fileStem(path: string) {
  const normalizedPath = normalizePath(path)
  const fileName = normalizedPath.split('/').filter(Boolean).at(-1) || ''
  return fileName.replace(/\.[^.]+$/, '')
}
