#!/usr/bin/env node
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, relative, resolve } from 'node:path'

export type ProjectNewOptions = {
  title: string
  outputPath: string
  force: boolean
  help: boolean
}

const initialChapterPath = 'manuscript/volume-001/chapter-001.md'
const starterCodexPath = 'codex/characters/protagonist.md'
const starterSceneDefPath = 'codex/locations/opening-gate.md'

export function buildProjectManifest(options: ProjectNewOptions) {
  return `${JSON.stringify(
    {
      $schema: schemaReferenceForManifest(options.outputPath),
      schema_version: 1,
      title: options.title,
      source_of_truth: 'markdown',
      chapters: [
        {
          id: 'chapter-001',
          title: '第001章 开篇',
          path: initialChapterPath,
          order: 1,
          story_time: {
            label: '开篇当日',
            sort_key: 1,
          },
          scene_def_ids: ['scene-opening-gate'],
        },
      ],
    },
    null,
    2,
  )}\n`
}

export function buildInitialChapter() {
  return `# 第001章 开篇

在这里开始第一章正文。主角站在雨中的山门前，握紧了自己的第一个目标。
`
}

export function buildStarterCodexCard() {
  return `---
id: char-protagonist
name: 主角
type: character
aliases: [主角]
keywords: [主角]
---

补充主角的外貌、性格、目标和当前状态。
`
}

export function buildStarterSceneDefCard() {
  return `---
id: scene-opening-gate
name: 开篇场景
type: scene_def
keywords: [开篇场景, 山门, 雨中山门]
---

记录本章主要发生地点、氛围、限制条件和可复用的场面元素。
`
}

export function buildMemoryEvalConfig(projectRoot: string) {
  return `${JSON.stringify(
    {
      $schema: schemaReferenceForMetaFile(
        projectRoot,
        'memory-eval.json',
        'memory-eval.schema.json',
      ),
      chapter_id: 'chapter-001',
      budget_chars: 600,
      minimum_gain: 0,
      expectations: [
        {
          id: 'starter-l2-current-prose',
          description: 'Starter project keeps the current chapter prose in L2.',
          layer: 'L2 风格',
          contains: ['当前章节原文', '主角站在雨中的山门前'],
        },
        {
          id: 'starter-l0-protagonist-card',
          description: 'Starter project recalls the protagonist card through explicit keywords.',
          layer: 'L0 事实',
          contains: ['主角', '当前状态'],
          source_contains: ['codex/characters/'],
          source_families: ['codex'],
        },
        {
          id: 'starter-l0-scene-card',
          description: 'Starter project injects the declared scene definition card.',
          layer: 'L0 事实',
          contains: ['开篇场景', '主要发生地点'],
          source_contains: ['codex/locations/'],
          source_families: ['codex'],
        },
        {
          id: 'starter-l3-recall-audit',
          description: 'Starter project exposes the keyword recall audit.',
          layer: 'L3 意图',
          contains: ['当前命中关键词', '命中设定'],
          source_contains: ['meta/project.json'],
          source_families: ['project'],
        },
      ],
    },
    null,
    2,
  )}\n`
}

export async function createNovelProject(options: ProjectNewOptions) {
  const root = resolve(options.outputPath)
  const files = [
    {
      path: resolve(root, 'meta', 'project.json'),
      source: buildProjectManifest({ ...options, outputPath: root }),
    },
    {
      path: resolve(root, 'meta', 'memory-eval.json'),
      source: buildMemoryEvalConfig(root),
    },
    {
      path: resolve(root, initialChapterPath),
      source: buildInitialChapter(),
    },
    {
      path: resolve(root, starterCodexPath),
      source: buildStarterCodexCard(),
    },
    {
      path: resolve(root, starterSceneDefPath),
      source: buildStarterSceneDefCard(),
    },
    {
      path: resolve(root, '.gitignore'),
      source: buildProjectGitignore(),
    },
  ]

  await mkdir(resolve(root, 'skills'), { recursive: true })
  await mkdir(projectSchemaDir(root), { recursive: true })
  await copyFile(resolve('schemas/project.schema.json'), projectSchemaPath(root))
  await copyFile(
    resolve('schemas/memory-eval.schema.json'),
    projectSchemaPath(root, 'memory-eval.schema.json'),
  )

  for (const file of files) {
    await mkdir(dirname(file.path), { recursive: true })
    await writeFile(file.path, file.source, {
      encoding: 'utf8',
      flag: options.force ? 'w' : 'wx',
    })
  }

  return {
    path: root,
    title: options.title,
    manifestPath: resolve(root, 'meta', 'project.json'),
  }
}

export function parseProjectNewArgs(args: string[]): ProjectNewOptions {
  const options: Partial<ProjectNewOptions> = {
    force: false,
    help: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const next = args[index + 1]

    if (arg === '--help' || arg === '-h') {
      options.help = true
    } else if (arg === '--force') {
      options.force = true
    } else if (arg === '--title') {
      options.title = requiredValue(arg, next)
      index += 1
    } else if (arg === '--out') {
      options.outputPath = requiredValue(arg, next)
      index += 1
    } else {
      throw new Error(`unknown argument: ${arg}`)
    }
  }

  if (options.help) {
    return {
      title: options.title || '我的长篇小说',
      outputPath: resolve(options.outputPath || 'MyNovel'),
      force: Boolean(options.force),
      help: true,
    }
  }

  if (!options.title) {
    throw new Error('--title is required.')
  }

  if (!options.outputPath) {
    throw new Error('--out is required.')
  }

  return {
    title: options.title,
    outputPath: resolve(options.outputPath),
    force: Boolean(options.force),
    help: false,
  }
}

function buildProjectGitignore() {
  return `.DS_Store
.novel/*.db
.novel/*.db-*
`
}

function schemaReferenceForManifest(projectRoot: string) {
  return schemaReferenceForMetaFile(
    projectRoot,
    'project.json',
    'project.schema.json',
  )
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

function requiredValue(flag: string, value?: string) {
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value.`)
  }

  return value
}

function printHelp() {
  console.log(`Create a Markdown-first Novel Engine project folder.

Usage:
  npm run project:new -- --title "我的长篇小说" --out /path/to/MyNovel

Options:
  --title <title>  Required. Project title written to meta/project.json.
  --out <path>     Required. Folder to create or populate.
  --force          Overwrite generated files if they already exist.
`)
}

async function main() {
  const options = parseProjectNewArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  const result = await createNovelProject(options)
  console.log(`Created ${result.path} (${result.title})`)
  console.log(`Next: npm run project:check -- ${result.path}`)
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
