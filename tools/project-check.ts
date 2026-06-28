#!/usr/bin/env node
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, relative, resolve } from 'node:path'
import {
  checkSkillManifests,
  type SkillCheckReport,
} from './skill-check.ts'
import {
  checkPublisherAdapters,
  type PublisherCheckReport,
} from './publisher-check.ts'
import {
  checkProviderAdapters,
  type ProviderCheckReport,
} from './provider-check.ts'
import { loadMemoryEvalConfig } from './memory-eval.ts'
import { loadProjectFromFiles } from '../src/project/projectFileLoader.ts'
import type { MarkdownFileSource } from '../src/project/projectFileLoader.ts'
import type { CodexEntry } from '../src/project/projectTypes.ts'

export type ProjectCheckReport = {
  rootPath: string
  ok: boolean
  title?: string
  stats: {
    chapters: number
    codexEntries: number
    codexEntriesWithoutKeywords: number
    codexEntriesWithDuplicateKeywords: number
    skillFiles: number
    failedSkillFiles: number
    publisherAdapters: number
    failedPublisherAdapters: number
    providerAdapters: number
    failedProviderAdapters: number
    memoryEvalExpectations: number
  }
  errors: string[]
  warnings: string[]
  skillReport?: SkillCheckReport
  publisherReport?: PublisherCheckReport
  providerReport?: ProviderCheckReport
}

type CliOptions = {
  rootPath: string
  json: boolean
  help: boolean
}

type RawProjectManifest = {
  $schema?: unknown
  schema_version?: unknown
  title?: string
  source_of_truth?: string
  chapters?: Array<{
    id?: string
    title?: string
    path?: string
    order?: unknown
  }>
}

type CodexRecallStats = {
  withoutKeywords: number
  withDuplicateKeywords: number
}

const projectManifestKeys = new Set([
  '$schema',
  'schema_version',
  'title',
  'source_of_truth',
  'chapters',
])

const projectManifestChapterKeys = new Set([
  'id',
  'title',
  'path',
  'order',
])

const manifestIdPattern = /^[a-z0-9][a-z0-9_.-]*$/

export async function checkNovelProject(
  rootPath = 'examples/demo-novel',
): Promise<ProjectCheckReport> {
  const absoluteRoot = resolve(rootPath)
  const errors: string[] = []
  const warnings: string[] = []
  let title: string | undefined
  let chapterCount = 0
  let codexCount = 0
  let codexRecallStats: CodexRecallStats = {
    withoutKeywords: 0,
    withDuplicateKeywords: 0,
  }
  let skillReport: SkillCheckReport | undefined
  let publisherReport: PublisherCheckReport | undefined
  let providerReport: ProviderCheckReport | undefined
  let memoryEvalExpectationCount = 0

  try {
    const rootStat = await stat(absoluteRoot)
    if (!rootStat.isDirectory()) {
      errors.push(`project root is not a directory: ${absoluteRoot}`)
    }
  } catch {
    errors.push(`project root does not exist: ${absoluteRoot}`)
  }

  const manifestPath = join(absoluteRoot, 'meta', 'project.json')
  let manifestSource = ''
  let rawManifest: RawProjectManifest | undefined

  if (errors.length === 0) {
    try {
      manifestSource = await readFile(manifestPath, 'utf8')
      const parsedManifest = JSON.parse(manifestSource) as unknown
      if (!isRecord(parsedManifest)) {
        errors.push('meta/project.json must be a JSON object.')
      } else {
        rawManifest = parsedManifest as RawProjectManifest
      }
    } catch (error) {
      errors.push(`meta/project.json: ${String(error)}`)
    }
  }

  const chapterFiles =
    errors.length === 0
      ? await collectMarkdownFiles(join(absoluteRoot, 'manuscript'), absoluteRoot)
      : []
  const codexFiles =
    errors.length === 0
      ? await collectMarkdownFiles(join(absoluteRoot, 'codex'), absoluteRoot)
      : []

  if (errors.length === 0 && rawManifest) {
    validateManifestShape(rawManifest, errors)

    const filePaths = new Set(chapterFiles.map((file) => file.path))
    const manifestChapters = Array.isArray(rawManifest.chapters)
      ? rawManifest.chapters
      : []
    const manifestChapterPaths = manifestChapters
      .filter(isRecord)
      .map((chapter) => normalizePath(stringValue(chapter.path) || ''))
      .filter(Boolean)

    for (const chapterPath of manifestChapterPaths) {
      if (!filePaths.has(chapterPath)) {
        errors.push(`manifest chapter file is missing: ${chapterPath}`)
      }
    }
    validateManifestChapters(rawManifest, errors)

    for (const file of chapterFiles) {
      if (
        manifestChapterPaths.length > 0 &&
        !manifestChapterPaths.includes(file.path)
      ) {
        warnings.push(`chapter file is not listed in manifest: ${file.path}`)
      }
    }

    try {
      const project = loadProjectFromFiles({
        rootPath: absoluteRoot,
        manifestSource,
        chapterFiles,
        codexFiles,
      })
      title = project.title
      chapterCount = project.chapters.length
      codexCount = project.codexEntries.length

      if (project.chapters.length === 0) {
        warnings.push('no manuscript Markdown chapters found.')
      }
      codexRecallStats = validateCodexRecallQuality(
        project.codexEntries,
        errors,
        warnings,
      )
    } catch (error) {
      errors.push(`project loader: ${String(error)}`)
    }
  }

  const memoryEvalConfig = await loadMemoryEvalConfig(absoluteRoot)
  if (memoryEvalConfig) {
    memoryEvalExpectationCount = memoryEvalConfig.expectations.length
    errors.push(...memoryEvalConfig.errors)
  }

  const skillsDir = join(absoluteRoot, 'skills')
  if (await pathExists(skillsDir)) {
    skillReport = await checkSkillManifests([skillsDir])
    for (const file of skillReport.files) {
      if (!file.ok) {
        errors.push(`${file.path}: ${file.errors.join(' ')}`)
      }
    }
  }

  const publisherAdapterPaths = ['publisher/adapters']
  const projectPublisherAdaptersDir = join(absoluteRoot, 'publisher', 'adapters')
  const publisherReports = [await checkPublisherAdapters(publisherAdapterPaths)]
  if (await pathExists(projectPublisherAdaptersDir)) {
    publisherReports.push(await checkPublisherAdapters([projectPublisherAdaptersDir]))
  }
  publisherReport = mergePublisherReports(publisherReports)
  for (const file of publisherReport.files) {
    if (!file.ok) {
      errors.push(`${file.path}: ${file.errors.join(' ')}`)
    }
  }

  const providerAdapterPaths = ['providers']
  const projectProvidersDir = join(absoluteRoot, 'providers')
  const providerReports = [await checkProviderAdapters(providerAdapterPaths)]
  if (await pathExists(projectProvidersDir)) {
    providerReports.push(await checkProviderAdapters([projectProvidersDir]))
  }
  providerReport = mergeProviderReports(providerReports)
  for (const file of providerReport.files) {
    if (!file.ok) {
      errors.push(`${file.path}: ${file.errors.join(' ')}`)
    }
  }

  return {
    rootPath: absoluteRoot,
    ok: errors.length === 0,
    title,
    stats: {
      chapters: chapterCount,
      codexEntries: codexCount,
      codexEntriesWithoutKeywords: codexRecallStats.withoutKeywords,
      codexEntriesWithDuplicateKeywords: codexRecallStats.withDuplicateKeywords,
      skillFiles: skillReport?.checked || 0,
      failedSkillFiles: skillReport?.failed || 0,
      publisherAdapters: publisherReport.checked,
      failedPublisherAdapters: publisherReport.failed,
      providerAdapters: providerReport.checked,
      failedProviderAdapters: providerReport.failed,
      memoryEvalExpectations: memoryEvalExpectationCount,
    },
    errors,
    warnings,
    skillReport,
    publisherReport,
    providerReport,
  }
}

function validateManifestChapters(
  rawManifest: RawProjectManifest,
  errors: string[],
) {
  const chapters = Array.isArray(rawManifest.chapters) ? rawManifest.chapters : []
  const seenIds = new Map<string, string>()
  const seenPaths = new Map<string, string>()
  const seenOrders = new Map<number, string>()

  chapters.forEach((chapter, index) => {
    if (!isRecord(chapter)) {
      return
    }

    const label = chapter.id || chapter.title || chapter.path || `chapters[${index}]`
    const path = normalizePath(chapter.path || '')
    const id = chapter.id?.trim() || fileStem(path)
    const order = chapter.order

    if (!path) {
      errors.push(`meta/project.json chapter ${label} path must be a non-empty string.`)
    }

    if (id) {
      const existingLabel = seenIds.get(id)
      if (existingLabel) {
        errors.push(
          `meta/project.json chapter id ${id} is duplicated by ${existingLabel} and ${label}.`,
        )
      } else {
        seenIds.set(id, label)
      }
    }

    if (path) {
      const existingLabel = seenPaths.get(path)
      if (existingLabel) {
        errors.push(
          `meta/project.json chapter path ${path} is duplicated by ${existingLabel} and ${label}.`,
        )
      } else {
        seenPaths.set(path, label)
      }
    }

    if (!Number.isInteger(order) || Number(order) <= 0) {
      errors.push(
        `meta/project.json chapter ${label} order must be a positive integer.`,
      )
      return
    }

    const orderNumber = Number(order)
    const existingLabel = seenOrders.get(orderNumber)
    if (existingLabel) {
      errors.push(
        `meta/project.json chapter order ${orderNumber} is duplicated by ${existingLabel} and ${label}.`,
      )
      return
    }

    seenOrders.set(orderNumber, label)
  })
}

function validateManifestShape(
  rawManifest: RawProjectManifest,
  errors: string[],
) {
  for (const key of Object.keys(rawManifest)) {
    if (!projectManifestKeys.has(key)) {
      errors.push(`meta/project.json unknown field: ${key}.`)
    }
  }

  if (
    rawManifest.$schema !== undefined &&
    !isNonEmptyString(rawManifest.$schema)
  ) {
    errors.push('meta/project.json $schema must be a non-empty string.')
  }

  if (
    rawManifest.schema_version !== undefined &&
    rawManifest.schema_version !== 1
  ) {
    errors.push('meta/project.json schema_version must be 1.')
  }

  if (
    rawManifest.title !== undefined &&
    !isNonEmptyString(rawManifest.title)
  ) {
    errors.push('meta/project.json title must be a non-empty string.')
  }

  if (
    rawManifest.source_of_truth !== undefined &&
    rawManifest.source_of_truth !== 'markdown'
  ) {
    errors.push('meta/project.json source_of_truth must be markdown.')
  }

  if (
    rawManifest.chapters !== undefined &&
    !Array.isArray(rawManifest.chapters)
  ) {
    errors.push('meta/project.json chapters must be an array when present.')
  }

  if (!Array.isArray(rawManifest.chapters)) {
    return
  }

  rawManifest.chapters.forEach((chapter, index) => {
    if (!isRecord(chapter)) {
      errors.push(`meta/project.json chapters[${index}] must be a JSON object.`)
      return
    }

    for (const key of Object.keys(chapter)) {
      if (!projectManifestChapterKeys.has(key)) {
        errors.push(`meta/project.json chapters[${index}] unknown field: ${key}.`)
      }
    }

    const label =
      stringValue(chapter.id) ||
      stringValue(chapter.title) ||
      stringValue(chapter.path) ||
      `chapters[${index}]`

    if (chapter.id !== undefined) {
      if (!isNonEmptyString(chapter.id)) {
        errors.push(`meta/project.json chapter ${label} id must be a non-empty string.`)
      } else if (!manifestIdPattern.test(chapter.id)) {
        errors.push(
          `meta/project.json chapter ${label} id must match /^[a-z0-9][a-z0-9_.-]*$/.`,
        )
      }
    }

    if (
      chapter.title !== undefined &&
      !isNonEmptyString(chapter.title)
    ) {
      errors.push(
        `meta/project.json chapter ${label} title must be a non-empty string.`,
      )
    }

    if (chapter.path !== undefined) {
      if (!isNonEmptyString(chapter.path)) {
        errors.push(`meta/project.json chapter ${label} path must be a non-empty string.`)
      } else if (!isRelativeMarkdownPath(chapter.path)) {
        errors.push(
          `meta/project.json chapter ${label} path must be a relative Markdown path.`,
        )
      }
    }
  })
}

function mergePublisherReports(
  reports: PublisherCheckReport[],
): PublisherCheckReport {
  const files = reports.flatMap((report) => report.files)
  const failed = files.filter((file) => !file.ok).length

  return {
    checked: files.length,
    passed: files.length - failed,
    failed,
    files,
  }
}

function mergeProviderReports(reports: ProviderCheckReport[]): ProviderCheckReport {
  const files = reports.flatMap((report) => report.files)
  const failed = files.filter((file) => !file.ok).length

  return {
    checked: files.length,
    passed: files.length - failed,
    failed,
    files,
  }
}

function validateCodexRecallQuality(
  codexEntries: CodexEntry[],
  errors: string[],
  warnings: string[],
): CodexRecallStats {
  const stats: CodexRecallStats = {
    withoutKeywords: 0,
    withDuplicateKeywords: 0,
  }

  for (const entry of codexEntries) {
    const keywords = entry.keywords.map((keyword) => keyword.trim()).filter(Boolean)
    const duplicateKeywords = findDuplicateStrings(keywords)

    if (keywords.length === 0) {
      stats.withoutKeywords += 1
      errors.push(
        `${entry.path}: codex entry has no keywords; L3 recall needs at least one explicit trigger.`,
      )
      continue
    }

    if (duplicateKeywords.length > 0) {
      stats.withDuplicateKeywords += 1
      warnings.push(
        `${entry.path}: codex entry has duplicate keywords: ${duplicateKeywords.join(', ')}`,
      )
    }

    if (!keywords.includes(entry.name)) {
      warnings.push(
        `${entry.path}: codex keywords do not include the entry name "${entry.name}". Add the name or an alias when direct recall should work.`,
      )
    }
  }

  return stats
}

function findDuplicateStrings(values: string[]) {
  const seen = new Set<string>()
  const duplicates = new Set<string>()

  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value)
    } else {
      seen.add(value)
    }
  }

  return [...duplicates]
}

export function formatProjectCheckReport(report: ProjectCheckReport): string {
  const lines = [
    `Project check: ${report.ok ? 'OK' : 'FAILED'}`,
    `Root: ${report.rootPath}`,
    report.title ? `Title: ${report.title}` : undefined,
    `Stats: ${report.stats.chapters} chapters, ${report.stats.codexEntries} codex entries (${report.stats.codexEntriesWithoutKeywords} missing keywords, ${report.stats.codexEntriesWithDuplicateKeywords} duplicate-keyword cards), ${report.stats.memoryEvalExpectations} memory eval expectations, ${report.stats.skillFiles} skill files, ${report.stats.publisherAdapters} publisher adapters, ${report.stats.providerAdapters} provider adapters`,
    ...report.warnings.map((warning) => `WARN ${warning}`),
    ...report.errors.map((error) => `ERROR ${error}`),
  ].filter((line): line is string => Boolean(line))

  return lines.join('\n')
}

async function collectMarkdownFiles(
  rootPath: string,
  projectRoot: string,
): Promise<MarkdownFileSource[]> {
  if (!(await pathExists(rootPath))) {
    return []
  }

  const files: MarkdownFileSource[] = []
  await collectMarkdownPath(rootPath, projectRoot, files)
  return files.sort((left, right) => left.path.localeCompare(right.path))
}

async function collectMarkdownPath(
  path: string,
  projectRoot: string,
  files: MarkdownFileSource[],
): Promise<void> {
  const pathStat = await stat(path)

  if (pathStat.isFile()) {
    if (path.endsWith('.md')) {
      files.push({
        path: normalizePath(relative(projectRoot, path)),
        filePath: path,
        content: await readFile(path, 'utf8'),
      })
    }
    return
  }

  if (!pathStat.isDirectory()) {
    return
  }

  const entries = await readdir(path, { withFileTypes: true })
  await Promise.all(
    entries.map((entry) =>
      collectMarkdownPath(join(path, entry.name), projectRoot, files),
    ),
  )
}

async function pathExists(path: string) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

function normalizePath(path: string) {
  return path.replace(/\\/g, '/')
}

function fileStem(path: string) {
  const normalizedPath = normalizePath(path)
  const fileName = normalizedPath.split('/').filter(Boolean).at(-1) || ''
  return fileName.replace(/\.[^.]+$/, '')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value : undefined
}

function isRelativeMarkdownPath(value: string) {
  const normalized = normalizePath(value)

  return (
    normalized.endsWith('.md') &&
    !normalized.startsWith('/') &&
    !/^[A-Za-z]:/.test(normalized)
  )
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    rootPath: 'examples/demo-novel',
    json: false,
    help: false,
  }

  for (const arg of args) {
    if (arg === '--json') {
      options.json = true
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    } else {
      options.rootPath = arg
    }
  }

  return options
}

function printHelp() {
  console.log(`Validate a Novel Engine project folder.

Usage:
  npm run project:check
  npm run project:check -- examples/demo-novel
  npm run project:check -- --json /path/to/MyNovel

Checks meta/project.json, meta/memory-eval.json, manuscript Markdown, codex Markdown, project-local Skills, publisher adapter manifests, and provider adapter manifests.
`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  const report = await checkNovelProject(options.rootPath)
  console.log(
    options.json
      ? JSON.stringify(report, null, 2)
      : formatProjectCheckReport(report),
  )

  if (!report.ok) {
    process.exitCode = 1
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
