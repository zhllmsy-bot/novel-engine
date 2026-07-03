#!/usr/bin/env node
import { copyFile, mkdir, readdir, readFile, stat, writeFile } from 'node:fs/promises'
import { basename, dirname, join, relative, resolve } from 'node:path'

export type ProjectImportOptions = {
  sourcePath: string
  outputPath: string
  title?: string
  force: boolean
  chaptersPerVolume: number
  help: boolean
}

export type ImportedChapter = {
  sourcePath: string
  targetPath: string
  id: string
  title: string
  order: number
  content: string
}

export type ProjectImportReport = {
  path: string
  sourcePath: string
  title: string
  manifestPath: string
  latestChapter?: {
    id: string
    title: string
    path: string
    order: number
  }
  nextChapterPath?: string
  stats: {
    chapters: number
    codexEntries: number
    sourceMarkdownFiles: number
    rawLedgerFiles: number
  }
  warnings: string[]
}

type SourceChapter = {
  sourcePath: string
  number: number
  content: string
}

const knownSourceMarkdown = [
  {
    fileName: 'README.md',
    targetPath: 'codex/notes/source-readme.md',
    id: 'note-source-readme',
    name: '源项目说明',
    type: 'note',
    keywords: ['源项目说明', '导入来源', '续写原则'],
  },
  {
    fileName: 'bible.md',
    targetPath: 'codex/world/bible.md',
    id: 'world-source-bible',
    name: '小说 Bible',
    type: 'world',
    keywords: ['小说 Bible', '核心设定', '角色', '势力', '能力', '卷结构'],
  },
  {
    fileName: 'outline-first-30.md',
    targetPath: 'codex/notes/outline-first-30.md',
    id: 'note-outline-first-30',
    name: '前30章大纲',
    type: 'note',
    keywords: ['前30章大纲', '前30章', '大纲', '节奏', '爽点'],
  },
  {
    fileName: 'quality-check.md',
    targetPath: 'codex/notes/quality-check.md',
    id: 'note-quality-check',
    name: '质量检查',
    type: 'note',
    keywords: ['质量检查', '续写', '爽点', '风险', '未解伏笔'],
  },
] as const

const jsonlLedgerNames: Record<string, string> = {
  ability: '能力账本',
  facts: '事实账本',
  factions: '势力账本',
  promises: '承诺账本',
  relationships: '关系账本',
}

export async function importExistingNovelProject(
  options: ProjectImportOptions,
): Promise<ProjectImportReport> {
  const sourceRoot = resolve(options.sourcePath)
  const outputRoot = resolve(options.outputPath)
  const warnings: string[] = []

  await assertDirectory(sourceRoot, 'source path')

  const sourceChapters = await discoverSourceChapters(sourceRoot)
  if (sourceChapters.length === 0) {
    throw new Error(`no Markdown chapters found under ${sourceRoot}`)
  }

  const title = options.title || await inferProjectTitle(sourceRoot)
  const importedChapters = await writeImportedChapters({
    outputRoot,
    chapters: sourceChapters,
    chaptersPerVolume: options.chaptersPerVolume,
    force: options.force,
  })
  const codexEntries = await writeImportedCodex({
    sourceRoot,
    outputRoot,
    title,
    chapters: importedChapters,
    force: options.force,
    warnings,
  })

  await mkdir(projectSchemaDir(outputRoot), { recursive: true })
  await copyFile(resolve('schemas/project.schema.json'), projectSchemaPath(outputRoot))
  await copyFile(
    resolve('schemas/memory-eval.schema.json'),
    projectSchemaPath(outputRoot, 'memory-eval.schema.json'),
  )

  await writeOutputFile({
    path: join(outputRoot, 'meta', 'project.json'),
    source: buildProjectManifest({
      outputPath: outputRoot,
      title,
      chapters: importedChapters,
    }),
    force: options.force,
  })
  await writeOutputFile({
    path: join(outputRoot, 'meta', 'memory-eval.json'),
    source: buildImportMemoryEvalConfig({
      outputPath: outputRoot,
      latestChapter: importedChapters.at(-1),
    }),
    force: options.force,
  })
  await writeOutputFile({
    path: join(outputRoot, '.gitignore'),
    source: buildProjectGitignore(),
    force: options.force,
  })

  const sourceMarkdownFiles = await copySourceReferences(sourceRoot, outputRoot)
  const rawLedgerFiles = await copyLedgerReferences(sourceRoot, outputRoot)
  await copyUploadReferences(sourceRoot, outputRoot)

  const latestChapter = importedChapters.at(-1)
  const nextChapterPath = latestChapter
    ? manuscriptPathForChapter(latestChapter.order + 1, options.chaptersPerVolume)
    : undefined
  await writeOutputFile({
    path: join(outputRoot, 'references', 'import-report.md'),
    source: buildImportReport({
      sourceRoot,
      outputRoot,
      title,
      chapters: importedChapters,
      nextChapterPath,
      warnings,
    }),
    force: options.force,
  })

  return {
    path: outputRoot,
    sourcePath: sourceRoot,
    title,
    manifestPath: join(outputRoot, 'meta', 'project.json'),
    latestChapter: latestChapter
      ? {
          id: latestChapter.id,
          title: latestChapter.title,
          path: latestChapter.targetPath,
          order: latestChapter.order,
        }
      : undefined,
    nextChapterPath,
    stats: {
      chapters: importedChapters.length,
      codexEntries,
      sourceMarkdownFiles,
      rawLedgerFiles,
    },
    warnings,
  }
}

export function buildProjectManifest(input: {
  outputPath: string
  title: string
  chapters: ImportedChapter[]
}) {
  return `${JSON.stringify(
    {
      $schema: schemaReferenceForMetaFile(
        input.outputPath,
        'project.json',
        'project.schema.json',
      ),
      schema_version: 1,
      title: input.title,
      source_of_truth: 'markdown',
      chapters: input.chapters.map((chapter) => ({
        id: chapter.id,
        title: chapter.title,
        path: chapter.targetPath,
        order: chapter.order,
      })),
    },
    null,
    2,
  )}\n`
}

export function buildImportMemoryEvalConfig(input: {
  outputPath: string
  latestChapter?: ImportedChapter
}) {
  const chapter = input.latestChapter
  const titleNeedle = chapter?.title || '当前章节原文'

  return `${JSON.stringify(
    {
      $schema: schemaReferenceForMetaFile(
        input.outputPath,
        'memory-eval.json',
        'memory-eval.schema.json',
      ),
      chapter_id: chapter?.id || 'chapter-001',
      budget_chars: 1200,
      minimum_gain: 0,
      expectations: [
        {
          id: 'import-l2-current-prose',
          description: 'Imported project keeps the latest chapter prose available for continuation.',
          layer: 'L2 风格',
          contains: ['当前章节原文', titleNeedle],
        },
        {
          id: 'import-l0-continuation-card',
          description: 'Imported project exposes a continuation-state card for the next writing step.',
          layer: 'L0 事实',
          contains: ['续写状态'],
          source_contains: ['codex/notes/continuation-state.md'],
          source_families: ['codex'],
        },
      ],
    },
    null,
    2,
  )}\n`
}

export async function discoverSourceChapters(sourceRoot: string): Promise<SourceChapter[]> {
  const chapterDir = join(sourceRoot, 'chapters')
  const chapterDirExists = await pathExists(chapterDir)
  const files = chapterDirExists
    ? await readdir(chapterDir)
    : await readdir(sourceRoot)

  const root = chapterDirExists ? chapterDir : sourceRoot
  const candidates = files
    .map((fileName) => {
      const match = fileName.match(/^(\d{1,5})\.md$/)
      return match
        ? {
            fileName,
            number: Number.parseInt(match[1], 10),
          }
        : undefined
    })
    .filter((file): file is { fileName: string; number: number } => Boolean(file))
    .toSorted((left, right) => left.number - right.number)

  return Promise.all(
    candidates.map(async (candidate) => ({
      sourcePath: join(root, candidate.fileName),
      number: candidate.number,
      content: await readFile(join(root, candidate.fileName), 'utf8'),
    })),
  )
}

export function parseProjectImportArgs(args: string[]): ProjectImportOptions {
  const options: Partial<ProjectImportOptions> = {
    force: false,
    help: false,
    chaptersPerVolume: 30,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const next = args[index + 1]

    if (arg === '--help' || arg === '-h') {
      options.help = true
    } else if (arg === '--force') {
      options.force = true
    } else if (arg === '--from') {
      options.sourcePath = requiredValue(arg, next)
      index += 1
    } else if (arg === '--out') {
      options.outputPath = requiredValue(arg, next)
      index += 1
    } else if (arg === '--title') {
      options.title = requiredValue(arg, next)
      index += 1
    } else if (arg === '--chapters-per-volume') {
      options.chaptersPerVolume = Number(requiredValue(arg, next))
      index += 1
    } else {
      throw new Error(`unknown argument: ${arg}`)
    }
  }

  if (options.help) {
    return {
      sourcePath: resolve(options.sourcePath || '.'),
      outputPath: resolve(options.outputPath || 'ImportedNovel'),
      title: options.title,
      force: Boolean(options.force),
      chaptersPerVolume: normalizeChaptersPerVolume(options.chaptersPerVolume),
      help: true,
    }
  }

  if (!options.sourcePath) {
    throw new Error('--from is required.')
  }

  if (!options.outputPath) {
    throw new Error('--out is required.')
  }

  return {
    sourcePath: resolve(options.sourcePath),
    outputPath: resolve(options.outputPath),
    title: options.title,
    force: Boolean(options.force),
    chaptersPerVolume: normalizeChaptersPerVolume(options.chaptersPerVolume),
    help: false,
  }
}

async function writeImportedChapters(input: {
  outputRoot: string
  chapters: SourceChapter[]
  chaptersPerVolume: number
  force: boolean
}): Promise<ImportedChapter[]> {
  const imported: ImportedChapter[] = []

  for (const chapter of input.chapters) {
    const targetPath = manuscriptPathForChapter(chapter.number, input.chaptersPerVolume)
    await writeOutputFile({
      path: join(input.outputRoot, targetPath),
      source: chapter.content,
      force: input.force,
    })
    imported.push({
      sourcePath: chapter.sourcePath,
      targetPath,
      id: `chapter-${String(chapter.number).padStart(3, '0')}`,
      title: chapterTitle(chapter.content, `第${String(chapter.number).padStart(3, '0')}章`),
      order: chapter.number,
      content: chapter.content,
    })
  }

  return imported
}

async function writeImportedCodex(input: {
  sourceRoot: string
  outputRoot: string
  title: string
  chapters: ImportedChapter[]
  force: boolean
  warnings: string[]
}) {
  let count = 0

  for (const sourceFile of knownSourceMarkdown) {
    const path = join(input.sourceRoot, sourceFile.fileName)
    if (!(await pathExists(path))) continue

    await writeOutputFile({
      path: join(input.outputRoot, sourceFile.targetPath),
      source: codexCard(
        {
          id: sourceFile.id,
          name: sourceFile.name,
          type: sourceFile.type,
          keywords: unique([sourceFile.name, input.title, ...sourceFile.keywords]),
        },
        await readFile(path, 'utf8'),
      ),
      force: input.force,
    })
    count += 1
  }

  const biblePath = join(input.sourceRoot, 'bible.md')
  if (await pathExists(biblePath)) {
    const protagonist = parseProtagonist(await readFile(biblePath, 'utf8'))
    if (protagonist) {
      await writeOutputFile({
        path: join(input.outputRoot, 'codex', '00-core', `${slugForName(protagonist.name)}.md`),
        source: codexCard(
          {
            id: `char-${slugForName(protagonist.name)}`,
            name: protagonist.name,
            type: 'character',
            aliases: [protagonist.name],
            keywords: unique([
              protagonist.name,
              input.title,
              ...protagonist.keywords,
            ]).slice(0, 10),
          },
          `# ${protagonist.name}\n\n${protagonist.body}`,
        ),
        force: input.force,
      })
      count += 1
    }
  }

  count += await writeLedgerCodex(input)
  await writeOutputFile({
    path: join(input.outputRoot, 'codex', 'notes', 'continuation-state.md'),
    source: buildContinuationStateCard({
      title: input.title,
      chapters: input.chapters,
    }),
    force: input.force,
  })
  count += 1

  const actualChapterCount = input.chapters.length
  const readme = await readOptional(join(input.sourceRoot, 'README.md'))
  const claimedChapterCount = readme ? inferClaimedChapterCount(readme) : undefined
  if (claimedChapterCount && claimedChapterCount !== actualChapterCount) {
    input.warnings.push(
      `source README claims ${claimedChapterCount} chapters, but ${actualChapterCount} chapter files were imported.`,
    )
  }

  return count
}

async function writeLedgerCodex(input: {
  sourceRoot: string
  outputRoot: string
  title: string
  force: boolean
}) {
  const ledgersRoot = join(input.sourceRoot, 'ledgers')
  if (!(await pathExists(ledgersRoot))) return 0

  const files = await readdir(ledgersRoot)
  let count = 0

  for (const fileName of files.toSorted()) {
    const sourcePath = join(ledgersRoot, fileName)
    const source = await readFile(sourcePath, 'utf8')
    const stem = fileName.replace(/\.[^.]+$/, '')
    const label = jsonlLedgerNames[stem] || `${stem} ledger`
    const markdownBody = fileName.endsWith('.jsonl')
      ? jsonlToMarkdown(source, label)
      : source

    await writeOutputFile({
      path: join(input.outputRoot, 'codex', 'ledgers', `${stem}.md`),
      source: codexCard(
        {
          id: `ledger-${slugForName(stem)}`,
          name: label,
          type: 'note',
          keywords: ledgerKeywords(stem, label, input.title),
        },
        markdownBody,
      ),
      force: input.force,
    })
    count += 1
  }

  return count
}

function buildContinuationStateCard(input: {
  title: string
  chapters: ImportedChapter[]
}) {
  const latest = input.chapters.at(-1)
  const nextChapterNumber = latest ? latest.order + 1 : 1
  const latestSource = latest ? latestChapterTail(latest) : ''
  const codeTerms = unique(latestSource.match(/[A-Z][A-Z0-9-]{3,}/g) || [])
  const keywords = unique([
    '续写状态',
    input.title,
    latest?.title || '',
    `第${nextChapterNumber}章`,
    ...codeTerms.slice(0, 5),
  ]).slice(0, 10)

  return codexCard(
    {
      id: 'note-continuation-state',
      name: '续写状态',
      type: 'note',
      keywords,
    },
    `# 续写状态\n\n- 当前已导入 ${input.chapters.length} 章。${latest ? `最新章节是《${latest.title}》。` : ''}\n- 下一章建议从第 ${nextChapterNumber} 章接续。\n${latest ? `- 最新章节路径：${latest.targetPath}\n` : ''}\n## 最新章节末段锚点\n\n${latestSource || '暂无。'}`,
  )
}

function latestChapterTail(chapter: ImportedChapter) {
  return chapter.content
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(-36)
    .join('\n')
}

async function copySourceReferences(sourceRoot: string, outputRoot: string) {
  let count = 0

  for (const fileName of await readdir(sourceRoot)) {
    if (!fileName.endsWith('.md')) continue
    const sourcePath = join(sourceRoot, fileName)
    if (!(await fileIsRegular(sourcePath))) continue

    await copyFileWithDirs(
      sourcePath,
      join(outputRoot, 'references', 'source', fileName),
    )
    count += 1
  }

  return count
}

async function copyLedgerReferences(sourceRoot: string, outputRoot: string) {
  const ledgersRoot = join(sourceRoot, 'ledgers')
  if (!(await pathExists(ledgersRoot))) return 0

  let count = 0
  for (const fileName of await readdir(ledgersRoot)) {
    const sourcePath = join(ledgersRoot, fileName)
    if (!(await fileIsRegular(sourcePath))) continue

    await copyFileWithDirs(
      sourcePath,
      join(outputRoot, 'references', 'ledgers', fileName),
    )
    count += 1
  }

  return count
}

async function copyUploadReferences(sourceRoot: string, outputRoot: string) {
  const uploadRoot = join(sourceRoot, 'upload')
  if (!(await pathExists(uploadRoot))) return

  for (const fileName of await readdir(uploadRoot)) {
    const sourcePath = join(uploadRoot, fileName)
    if (!(await fileIsRegular(sourcePath))) continue

    await copyFileWithDirs(
      sourcePath,
      join(outputRoot, 'references', 'upload', fileName),
    )
  }
}

function buildImportReport(input: {
  sourceRoot: string
  outputRoot: string
  title: string
  chapters: ImportedChapter[]
  nextChapterPath?: string
  warnings: string[]
}) {
  const latest = input.chapters.at(-1)

  return `# 导入说明\n\n- Source: ${input.sourceRoot}\n- Output: ${input.outputRoot}\n- Title: ${input.title}\n- Imported chapters: ${input.chapters.length}\n- Chapter layout: generated under manuscript/volume-xxx while preserving order in meta/project.json.\n${latest ? `- Latest chapter: ${latest.title}\n- Latest chapter path: ${latest.targetPath}\n` : ''}${input.nextChapterPath ? `- Next continuation chapter path: ${input.nextChapterPath}\n` : ''}${input.warnings.length > 0 ? `\n## Warnings\n\n${input.warnings.map((warning) => `- ${warning}`).join('\n')}\n` : ''}`
}

async function inferProjectTitle(sourceRoot: string) {
  const readme = await readOptional(join(sourceRoot, 'README.md'))
  if (readme) {
    const titleMatch = readme.match(/^#\s+《?([^》\n]+)》?/m)
    if (titleMatch?.[1]?.trim()) {
      return titleMatch[1].replace(/项目包$/, '').trim()
    }
  }

  const bible = await readOptional(join(sourceRoot, 'bible.md'))
  if (bible) {
    const titleCandidateMatch = bible.match(/\|\s*1\s*\|\s*([^|\n]+)\|/)
    if (titleCandidateMatch?.[1]?.trim()) {
      return titleCandidateMatch[1].trim()
    }
  }

  return basename(sourceRoot)
}

function parseProtagonist(bible: string) {
  const section = extractSection(bible, 'Protagonist')
  if (!section) return undefined

  const name = section.match(/-\s*Name:\s*([^\n]+)/)?.[1]?.trim()
  if (!name) return undefined

  const keywords = [
    ...section.matchAll(/-\s*(?:Hidden strength|Long desire|Fear|Public flaw):\s*([^\n]+)/g),
  ].map((match) => match[1].trim())

  return {
    name,
    keywords,
    body: section,
  }
}

function extractSection(markdown: string, title: string) {
  const lines = markdown.split('\n')
  const start = lines.findIndex((line) => line.trim() === `## ${title}`)
  if (start < 0) return ''

  const body: string[] = []
  for (const line of lines.slice(start + 1)) {
    if (/^##\s+/.test(line)) break
    body.push(line)
  }

  return body.join('\n').trim()
}

function jsonlToMarkdown(source: string, title: string) {
  const lines = source.split('\n').map((line) => line.trim()).filter(Boolean)
  const bullets = lines.map((line) => {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>
      return `- ${Object.entries(parsed)
        .map(([key, value]) => `${key}: ${renderJsonValue(value)}`)
        .join('；')}`
    } catch {
      return `- ${line}`
    }
  })

  return `# ${title}\n\n${bullets.join('\n')}\n`
}

function renderJsonValue(value: unknown) {
  if (Array.isArray(value)) return value.join('、')
  if (value && typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

function ledgerKeywords(stem: string, label: string, title: string) {
  const base = {
    ability: ['能力', '能力账本', '风险线', '代价'],
    facts: ['事实', '事实账本', '阶段性答案', '异常成立'],
    factions: ['势力', '势力账本', '组织', '资源'],
    promises: ['承诺', '承诺账本', '伏笔', '回收期'],
    relationships: ['关系', '关系账本', '关系线', '信任'],
    timeline: ['时间线', '时间线账本', '故事时间'],
    unresolved: ['未解问题', '未解问题账本', '下一步'],
  }[stem] || [stem, label]

  return unique([label, title, ...base]).slice(0, 8)
}

function codexCard(
  fields: Record<string, string | string[]>,
  body: string,
) {
  return `---\n${Object.entries(fields)
    .map(([key, value]) => `${key}: ${yamlValue(value)}`)
    .join('\n')}\n---\n\n${body.trim()}\n`
}

function yamlValue(value: string | string[]) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => JSON.stringify(item)).join(', ')}]`
  }

  return JSON.stringify(value)
}

function manuscriptPathForChapter(order: number, chaptersPerVolume: number) {
  const volume = Math.ceil(order / chaptersPerVolume)

  return `manuscript/volume-${String(volume).padStart(3, '0')}/chapter-${String(order).padStart(3, '0')}.md`
}

function chapterTitle(content: string, fallback: string) {
  const heading = content
    .split('\n')
    .find((line) => line.trim().startsWith('#'))
    ?.replace(/^#+/, '')
    .trim()

  return heading || fallback
}

function slugForName(value: string) {
  const ascii = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (ascii) return ascii

  return [...value.trim()]
    .map((char) => char.codePointAt(0)?.toString(16) || '')
    .filter(Boolean)
    .join('-')
}

function inferClaimedChapterCount(readme: string) {
  const matches = [...readme.matchAll(/(?:到|至|through)\s*`?chapters\/0*(\d+)\.md`?|前\s*(\d+)\s*章|(\d+)\s*章正文/g)]
  const numbers = matches
    .flatMap((match) => match.slice(1))
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0)

  return numbers.length > 0 ? Math.max(...numbers) : undefined
}

function buildProjectGitignore() {
  return `.DS_Store\n.novel/*.db\n.novel/*.db-*\n`
}

async function writeOutputFile(input: {
  path: string
  source: string
  force: boolean
}) {
  await mkdir(dirname(input.path), { recursive: true })
  await writeFile(input.path, input.source, {
    encoding: 'utf8',
    flag: input.force ? 'w' : 'wx',
  })
}

async function copyFileWithDirs(sourcePath: string, targetPath: string) {
  await mkdir(dirname(targetPath), { recursive: true })
  await copyFile(sourcePath, targetPath)
}

async function assertDirectory(path: string, label: string) {
  try {
    const pathStat = await stat(path)
    if (!pathStat.isDirectory()) {
      throw new Error(`${label} is not a directory: ${path}`)
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes('is not a directory')) {
      throw error
    }
    throw new Error(`${label} does not exist: ${path}`)
  }
}

async function fileIsRegular(path: string) {
  try {
    return (await stat(path)).isFile()
  } catch {
    return false
  }
}

async function pathExists(path: string) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}

async function readOptional(path: string) {
  try {
    return await readFile(path, 'utf8')
  } catch {
    return undefined
  }
}

function schemaReferenceForMetaFile(
  projectRoot: string,
  metaFileName: string,
  schemaFileName: string,
) {
  const metaPath = resolve(projectRoot, 'meta', metaFileName)
  const relativePath = relative(
    dirname(metaPath),
    projectSchemaPath(projectRoot, schemaFileName),
  ).replaceAll('\\', '/')

  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`
}

function projectSchemaDir(projectRoot: string) {
  return resolve(projectRoot, '.novel', 'schemas')
}

function projectSchemaPath(
  projectRoot: string,
  schemaFileName = 'project.schema.json',
) {
  return resolve(projectSchemaDir(projectRoot), schemaFileName)
}

function normalizeChaptersPerVolume(value: unknown) {
  const parsed = Number(value)
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error('--chapters-per-volume must be a positive integer.')
  }

  return parsed
}

function requiredValue(flag: string, value?: string) {
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value.`)
  }

  return value
}

function unique(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}

function printHelp() {
  console.log(`Import an existing Markdown novel package into Novel Engine format.\n\nUsage:\n  npm run project:import -- --from /path/to/source --out /path/to/MyNovel\n\nOptions:\n  --from <path>                Required. Source folder with chapters/*.md or numeric *.md files.\n  --out <path>                 Required. Output Novel Engine project folder.\n  --title <title>              Optional. Project title override.\n  --chapters-per-volume <num>  Optional. Defaults to 30.\n  --force                      Overwrite generated files if they already exist.\n`)
}

async function main() {
  const options = parseProjectImportArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  const report = await importExistingNovelProject(options)
  console.log(`Imported ${report.stats.chapters} chapters into ${report.path}`)
  console.log(`Title: ${report.title}`)
  if (report.latestChapter) {
    console.log(`Latest: ${report.latestChapter.title}`)
  }
  if (report.nextChapterPath) {
    console.log(`Next: ${report.nextChapterPath}`)
  }
  for (const warning of report.warnings) {
    console.warn(`WARN ${warning}`)
  }
  console.log(`Next check: npm run project:check -- ${report.path}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
