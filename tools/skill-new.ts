#!/usr/bin/env node
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { parseSkillManifest } from '../src/skills/skillManifest.ts'
import type { SkillOutputMode, SkillRiskLevel } from '../src/types/domain.ts'

type SkillNewOptions = {
  id: string
  name: string
  outputPath: string
  projectRoot?: string
  mode: SkillOutputMode
  schema?: SkillOutputSchema
  risk: SkillRiskLevel
  category: string
  force: boolean
  help: boolean
}

type SkillOutputSchema =
  | 'report'
  | 'diff_patch'
  | 'character_state_proposal'
  | 'plot_thread_proposal'
  | 'mixed_memory_update'
  | 'chapter_summary'
  | 'export_artifact'

const outputModes = new Set<SkillOutputMode>([
  'report',
  'rewrite_patch',
  'memory_update_proposal',
  'chapter_summary',
  'export_artifact',
])

const riskLevels = new Set<SkillRiskLevel>(['low', 'medium', 'high'])
const outputSchemas = new Set<SkillOutputSchema>([
  'report',
  'diff_patch',
  'character_state_proposal',
  'plot_thread_proposal',
  'mixed_memory_update',
  'chapter_summary',
  'export_artifact',
])

export function buildSkillTemplate(options: SkillNewOptions) {
  const outputSchema = options.schema || outputSchemaForMode(options.mode)
  const requireSnapshot =
    options.mode === 'rewrite_patch' ? '  require_snapshot_before_apply: true\n' : ''
  const schemaPath = schemaReferenceForOutputPath(
    options.outputPath,
    options.projectRoot,
  )
  const sourceFamilies = defaultSourceFamiliesForSkill({
    mode: options.mode,
    schema: outputSchema,
  })
  const sourceFamilyLines = sourceFamilies
    .map((family) => `    - ${family}`)
    .join('\n')

  return `# yaml-language-server: $schema=${schemaPath}
id: ${options.id}
name: ${options.name}
version: 0.1.0
category: ${options.category}
description: 描述这个 Skill 的用途、边界和不该修改的内容。
risk_level: ${options.risk}
prompt: |
  你是长篇小说编辑 Skill。
  明确说明模型应该读取哪些上下文、输出什么、禁止新增哪些未经正文支持的设定。
  高风险输出必须作为提案返回，等待作者确认。

input:
  required:
    - nearby_text
  optional:
    - selected_text
    - chapter_summary
    - character_cards
    - recent_style
    - recall_audit
    - user_instruction

retrieval:
  include_recent_chapters: 1
  include_characters: auto
  include_worldbuilding: auto
  include_recall: auto
  source_families:
${sourceFamilyLines}

model:
  profile: balanced
  temperature: 0.7

output:
  mode: ${options.mode}
  schema: ${outputSchema}

safety:
${requireSnapshot}  require_user_review: true
`
}

export async function createSkillManifest(options: SkillNewOptions) {
  const source = buildSkillTemplate(options)
  const parsed = parseSkillManifest(source)

  if (!parsed.ok) {
    throw new Error(`Generated Skill did not validate:\n${parsed.errors.join('\n')}`)
  }

  await ensureProjectSkillSchema(options.projectRoot)
  await mkdir(dirname(options.outputPath), { recursive: true })
  await writeFile(options.outputPath, source, {
    encoding: 'utf8',
    flag: options.force ? 'w' : 'wx',
  })

  return {
    path: options.outputPath,
    skillId: parsed.manifest.id,
  }
}

export function parseSkillNewArgs(args: string[]): SkillNewOptions {
  const options: Partial<SkillNewOptions> = {
    mode: 'rewrite_patch',
    risk: 'medium',
    category: 'rewrite',
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
    } else if (arg === '--id') {
      options.id = requiredValue(arg, next)
      index += 1
    } else if (arg === '--name') {
      options.name = requiredValue(arg, next)
      index += 1
    } else if (arg === '--out') {
      options.outputPath = requiredValue(arg, next)
      index += 1
    } else if (arg === '--project') {
      options.projectRoot = requiredValue(arg, next)
      index += 1
    } else if (arg === '--mode') {
      options.mode = parseOutputMode(requiredValue(arg, next))
      index += 1
    } else if (arg === '--schema') {
      options.schema = parseOutputSchema(requiredValue(arg, next))
      index += 1
    } else if (arg === '--risk') {
      options.risk = parseRiskLevel(requiredValue(arg, next))
      index += 1
    } else if (arg === '--category') {
      options.category = requiredValue(arg, next)
      index += 1
    } else {
      throw new Error(`unknown argument: ${arg}`)
    }
  }

  if (options.help) {
    const id = options.id || 'community.example_skill'

    return {
      id,
      name: options.name || '示例 Skill',
      outputPath: resolveSkillOutputPath({
        id,
        outputPath: options.outputPath,
        projectRoot: options.projectRoot,
        fallback: 'examples/skills/example.skill.yaml',
      }),
      projectRoot: options.projectRoot ? resolve(options.projectRoot) : undefined,
      mode: options.mode || 'rewrite_patch',
      schema: options.schema,
      risk: options.risk || 'medium',
      category: options.category || 'rewrite',
      force: Boolean(options.force),
      help: true,
    }
  }

  if (!options.id) {
    throw new Error('--id is required.')
  }

  if (!options.name) {
    throw new Error('--name is required.')
  }

  return {
    id: options.id,
    name: options.name,
    outputPath: resolveSkillOutputPath({
      id: options.id,
      outputPath: options.outputPath,
      projectRoot: options.projectRoot,
      fallback: `examples/skills/${options.id}.skill.yaml`,
    }),
    projectRoot: options.projectRoot ? resolve(options.projectRoot) : undefined,
    mode: options.mode || 'rewrite_patch',
    schema: options.schema,
    risk: options.risk || 'medium',
    category: options.category || 'rewrite',
    force: Boolean(options.force),
    help: false,
  }
}

function outputSchemaForMode(mode: SkillOutputMode) {
  switch (mode) {
    case 'rewrite_patch':
      return 'diff_patch'
    case 'memory_update_proposal':
      return 'mixed_memory_update'
    case 'chapter_summary':
      return 'chapter_summary'
    case 'export_artifact':
      return 'export_artifact'
    case 'report':
      return 'report'
  }
}

function defaultSourceFamiliesForSkill({
  mode,
  schema,
}: {
  mode: SkillOutputMode
  schema: SkillOutputSchema
}) {
  if (mode === 'memory_update_proposal') {
    return schema === 'character_state_proposal'
      ? ['manuscript', 'codex', 'character_state_log', 'chapter_summary', 'recall']
      : [
          'manuscript',
          'codex',
          'chapter_summary',
          'plot_thread',
          'recall',
        ]
  }

  if (mode === 'report') {
    return [
      'manuscript',
      'codex',
      'project',
      'chapter_summary',
      'volume_summary',
      'plot_thread',
      'character_state_log',
      'recall',
    ]
  }

  if (mode === 'export_artifact') {
    return ['manuscript', 'project', 'chapter_summary', 'volume_summary']
  }

  if (mode === 'chapter_summary') {
    return ['manuscript', 'codex', 'chapter_summary', 'plot_thread', 'recall']
  }

  return ['manuscript', 'codex', 'chapter_summary', 'recall']
}

function resolveSkillOutputPath({
  id,
  outputPath,
  projectRoot,
  fallback,
}: {
  id: string
  outputPath?: string
  projectRoot?: string
  fallback: string
}) {
  if (!projectRoot) {
    return resolve(outputPath || fallback)
  }

  const root = resolve(projectRoot)
  if (outputPath) {
    return isAbsolute(outputPath) ? outputPath : resolve(root, outputPath)
  }

  return resolve(root, 'skills', `${id}.skill.yaml`)
}

async function ensureProjectSkillSchema(projectRoot?: string) {
  if (!projectRoot) return

  const targetPath = projectSkillSchemaPath(projectRoot)
  await mkdir(dirname(targetPath), { recursive: true })
  await copyFile(repoSkillSchemaPath(), targetPath)
}

function schemaReferenceForOutputPath(outputPath: string, projectRoot?: string) {
  const targetSchemaPath = projectRoot
    ? projectSkillSchemaPath(projectRoot)
    : repoSkillSchemaPath()
  const schemaPath = relative(
    dirname(resolve(outputPath)),
    targetSchemaPath,
  ).replaceAll('\\', '/')

  return schemaPath.startsWith('.') ? schemaPath : `./${schemaPath}`
}

function repoSkillSchemaPath() {
  return resolve('schemas/skill.schema.json')
}

function projectSkillSchemaPath(projectRoot: string) {
  return resolve(projectRoot, '.novel', 'schemas', 'skill.schema.json')
}

function requiredValue(flag: string, value?: string) {
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value.`)
  }

  return value
}

function parseOutputMode(value: string): SkillOutputMode {
  if (!outputModes.has(value as SkillOutputMode)) {
    throw new Error(
      `--mode must be one of: ${[...outputModes].join(', ')}.`,
    )
  }

  return value as SkillOutputMode
}

function parseRiskLevel(value: string): SkillRiskLevel {
  if (!riskLevels.has(value as SkillRiskLevel)) {
    throw new Error(`--risk must be one of: ${[...riskLevels].join(', ')}.`)
  }

  return value as SkillRiskLevel
}

function parseOutputSchema(value: string): SkillOutputSchema {
  if (!outputSchemas.has(value as SkillOutputSchema)) {
    throw new Error(`--schema must be one of: ${[...outputSchemas].join(', ')}.`)
  }

  return value as SkillOutputSchema
}

function printHelp() {
  console.log(`Create a validated Novel Engine Skill manifest.

Usage:
  npm run skills:new -- --id community.dialogue_polish --name "对白润色"
  npm run skills:new -- --project examples/demo-novel --id demo.foreshadowing --name "本书伏笔体检" --mode memory_update_proposal --schema mixed_memory_update --category memory
  npm run skills:new -- --id xuanhuan.foreshadowing --name "伏笔检查" --mode memory_update_proposal --schema plot_thread_proposal --category memory
  npm run skills:new -- --id core.chapter_summary --name "章节摘要" --mode chapter_summary --risk low --category memory
  npm run skills:new -- --id community.report --name "章节体检" --mode report --risk low --out skills/report.skill.yaml

Options:
  --id <id>          Required. Lowercase id such as community.dialogue_polish.
  --name <name>      Required. Display name shown in the editor.
  --out <path>       Output path. Defaults to examples/skills/<id>.skill.yaml.
  --project <path>   Novel project root. Defaults output to <project>/skills/<id>.skill.yaml.
  --mode <mode>      report, rewrite_patch, memory_update_proposal, chapter_summary, export_artifact.
  --schema <schema>  Output schema. Defaults from --mode when omitted.
  --risk <level>     low, medium, or high.
  --category <name>  Free-form category such as rewrite, memory, export.
  --force            Overwrite an existing file.
`)
}

async function main() {
  const options = parseSkillNewArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  const result = await createSkillManifest(options)
  console.log(`Created ${result.path} (${result.skillId})`)
  console.log(
    'Next: ' +
      (options.projectRoot
        ? `npm run project:check -- ${options.projectRoot}`
        : `npm run skills:check -- ${dirname(result.path)}`),
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
