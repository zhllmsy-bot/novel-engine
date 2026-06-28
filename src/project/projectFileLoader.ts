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
    content: parsed.body,
    wordCount: parsed.wordCount,
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
    }
  })
}

function normalizePath(path: string) {
  return path.replace(/\\/g, '/')
}

function fileStem(path: string) {
  const normalizedPath = normalizePath(path)
  const fileName = normalizedPath.split('/').filter(Boolean).at(-1) || ''
  return fileName.replace(/\.[^.]+$/, '')
}
