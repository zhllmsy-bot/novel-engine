#!/usr/bin/env node
import { readdir, readFile, stat } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseSkillManifest } from '../src/skills/skillManifest.ts'

export type SkillCheckFileResult = {
  path: string
  ok: boolean
  skillId?: string
  errors: string[]
}

export type SkillCheckReport = {
  checked: number
  passed: number
  failed: number
  files: SkillCheckFileResult[]
}

type CliOptions = {
  paths: string[]
  json: boolean
  help: boolean
}

export async function checkSkillManifests(
  inputPaths: string[],
): Promise<SkillCheckReport> {
  const paths = inputPaths.length > 0 ? inputPaths : ['examples/skills']
  const files = await collectSkillManifestFiles(paths)
  const results = await Promise.all(files.map(checkSkillManifestFile))
  markDuplicateSkillIds(results)
  const failed = results.filter((result) => !result.ok).length

  return {
    checked: results.length,
    passed: results.length - failed,
    failed,
    files: results,
  }
}

export async function collectSkillManifestFiles(
  inputPaths: string[],
): Promise<string[]> {
  const collected = new Set<string>()

  for (const inputPath of inputPaths) {
    await collectSkillManifestPath(resolve(inputPath), collected)
  }

  return [...collected].sort()
}

export async function checkSkillManifestFile(
  path: string,
): Promise<SkillCheckFileResult> {
  const source = await readFile(path, 'utf8')
  const result = parseSkillManifest(source)

  if (!result.ok) {
    return {
      path,
      ok: false,
      errors: result.errors,
    }
  }

  return {
    path,
    ok: true,
    skillId: result.manifest.id,
    errors: [],
  }
}

function markDuplicateSkillIds(results: SkillCheckFileResult[]) {
  const seen = new Map<string, string>()

  for (const result of results) {
    if (!result.ok || !result.skillId) continue

    const previousPath = seen.get(result.skillId)
    if (previousPath) {
      result.ok = false
      result.errors.push(
        `duplicate Skill id ${result.skillId} already declared in ${previousPath}.`,
      )
      continue
    }

    seen.set(result.skillId, result.path)
  }
}

export function formatSkillCheckReport(report: SkillCheckReport): string {
  const lines = [
    `Skill check: ${report.passed}/${report.checked} passed`,
    ...report.files.map((file) => {
      if (file.ok) {
        return `OK ${file.path} (${file.skillId})`
      }

      return `FAIL ${file.path}\n${file.errors.map((error) => `  - ${error}`).join('\n')}`
    }),
  ]

  return lines.join('\n')
}

async function collectSkillManifestPath(
  path: string,
  collected: Set<string>,
): Promise<void> {
  const pathStat = await stat(path)

  if (pathStat.isFile()) {
    if (isSkillManifestPath(path)) {
      collected.add(path)
    }
    return
  }

  if (!pathStat.isDirectory()) {
    return
  }

  const entries = await readdir(path, { withFileTypes: true })
  await Promise.all(
    entries.map((entry) =>
      collectSkillManifestPath(resolve(path, entry.name), collected),
    ),
  )
}

function isSkillManifestPath(path: string) {
  return path.endsWith('.skill.yaml') || path.endsWith('.skill.yml')
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    paths: [],
    json: false,
    help: false,
  }

  for (const arg of args) {
    if (arg === '--json') {
      options.json = true
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    } else {
      options.paths.push(arg)
    }
  }

  return options
}

function printHelp() {
  console.log(`Validate Novel Engine Skill manifests.

Usage:
  npm run skills:check
  npm run skills:check -- examples/skills
  npm run skills:check -- --json path/to/skills

Only files ending in .skill.yaml or .skill.yml are checked.
`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  const report = await checkSkillManifests(options.paths)
  console.log(
    options.json ? JSON.stringify(report, null, 2) : formatSkillCheckReport(report),
  )

  if (report.failed > 0) {
    process.exitCode = 1
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
