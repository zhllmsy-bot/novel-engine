import { readdir, readFile, stat } from 'node:fs/promises'
import { basename, join } from 'node:path'
import type { PublishChapterPayload } from './types.ts'

const frontmatterPattern = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/
const chapterTitlePattern =
  /^第\s*([零一二三四五六七八九十百千万亿\d]+)\s*章\s*(.*)$/
const chineseDigitMap = new Map<string, number>([
  ['零', 0],
  ['一', 1],
  ['二', 2],
  ['三', 3],
  ['四', 4],
  ['五', 5],
  ['六', 6],
  ['七', 7],
  ['八', 8],
  ['九', 9],
])
const chineseUnitMap = new Map<string, number>([
  ['十', 10],
  ['百', 100],
  ['千', 1000],
  ['万', 10000],
  ['亿', 100000000],
])

export async function loadChaptersFromDir(
  dirPath: string,
  startFrom = 1,
): Promise<PublishChapterPayload[]> {
  const dirStat = await stat(dirPath)
  if (!dirStat.isDirectory()) {
    throw new Error(`Chapter source is not a directory: ${dirPath}`)
  }

  const entries = await readdir(dirPath, { withFileTypes: true })
  const chapters = await Promise.all(
    entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
      .map(async (entry, index) => {
        const sourcePath = join(dirPath, entry.name)
        const source = await readFile(sourcePath, 'utf8')
        return parseMarkdownChapter(source, sourcePath, index + 1)
      }),
  )

  return chapters
    .filter((chapter) => chapter.number >= startFrom)
    .sort((left, right) => left.number - right.number)
}

export function parseMarkdownChapter(
  source: string,
  sourcePath: string,
  fallbackNumber = 0,
): PublishChapterPayload {
  const withoutFrontmatter = source.replace(frontmatterPattern, '')
  const lines = withoutFrontmatter.split(/\r?\n/)
  const headingIndex = lines.findIndex((line) => line.trim().startsWith('#'))
  const rawTitle =
    headingIndex >= 0
      ? lines[headingIndex].replace(/^#+/, '').trim()
      : fileStem(sourcePath)
  const titleMatch = rawTitle.match(chapterTitlePattern)
  const number = titleMatch
    ? parseChapterNumber(titleMatch[1])
    : numberFromPath(sourcePath) || fallbackNumber
  const title = titleMatch ? titleMatch[2].trim() || rawTitle : rawTitle
  const bodyLines =
    headingIndex >= 0
      ? [...lines.slice(0, headingIndex), ...lines.slice(headingIndex + 1)]
      : lines
  const content = bodyLines
    .filter((line) => !line.trim().startsWith('<!--'))
    .join('\n')
    .trim()

  return {
    id: `${number || fallbackNumber}:${sourcePath}`,
    number,
    title,
    content,
    sourcePath,
    wordCount: countNonWhitespace(content),
  }
}

export function parseChapterNumber(value: string): number {
  const normalized = value.trim()
  if (/^\d+$/.test(normalized)) {
    return Number(normalized)
  }

  let result = 0
  let current = 0

  for (const char of normalized) {
    const unit = chineseUnitMap.get(char)
    if (unit) {
      result += (current || 1) * unit
      current = 0
      continue
    }

    const digit = chineseDigitMap.get(char)
    if (digit !== undefined) {
      current = current * 10 + digit
    }
  }

  return result + current
}

function numberFromPath(path: string): number {
  const match = fileStem(path).match(/(\d+)/)
  return match ? Number(match[1]) : 0
}

function fileStem(path: string): string {
  return basename(path).replace(/\.[^.]+$/, '')
}

function countNonWhitespace(value: string): number {
  return value.replace(/\s/g, '').length
}
