#!/usr/bin/env node
import { readdir, readFile, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parseProviderAdapterManifest } from '../src/ai/providerManifest.ts'

export type ProviderCheckFileResult = {
  path: string
  ok: boolean
  providerId?: string
  errors: string[]
}

export type ProviderCheckReport = {
  checked: number
  passed: number
  failed: number
  files: ProviderCheckFileResult[]
}

type CliOptions = {
  paths: string[]
  json: boolean
  help: boolean
}

export async function checkProviderAdapters(
  inputPaths: string[],
): Promise<ProviderCheckReport> {
  const paths = inputPaths.length > 0 ? inputPaths : ['providers']
  const files = (
    await Promise.all(paths.map((path) => collectProviderAdapterManifestFiles(path)))
  )
    .flat()
    .toSorted((left, right) => left.localeCompare(right))
  const results = await Promise.all(files.map(checkProviderAdapterFile))
  markDuplicateProviderIds(results)
  const failed = results.filter((result) => !result.ok).length

  return {
    checked: results.length,
    passed: results.length - failed,
    failed,
    files: results,
  }
}

function markDuplicateProviderIds(results: ProviderCheckFileResult[]) {
  const seen = new Map<string, string>()

  for (const result of results) {
    if (!result.ok || !result.providerId) continue

    const previousPath = seen.get(result.providerId)
    if (previousPath) {
      result.ok = false
      result.errors.push(
        `duplicate provider adapter id ${result.providerId} already declared in ${previousPath}.`,
      )
      continue
    }

    seen.set(result.providerId, result.path)
  }
}

export async function collectProviderAdapterManifestFiles(
  rootPath = 'providers',
): Promise<string[]> {
  const absoluteRoot = resolve(rootPath)

  if (!(await pathExists(absoluteRoot))) {
    return []
  }

  const files: string[] = []
  await collectManifestPath(absoluteRoot, files)
  return files.sort((left, right) => left.localeCompare(right))
}

export async function checkProviderAdapterFile(
  path: string,
): Promise<ProviderCheckFileResult> {
  const result = parseProviderAdapterManifest(await readFile(path, 'utf8'))

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
    providerId: result.manifest.id,
    errors: [],
  }
}

export function formatProviderCheckReport(report: ProviderCheckReport): string {
  const lines = [
    `Provider adapter check: ${report.passed}/${report.checked} passed`,
    ...report.files.map((file) => {
      if (file.ok) {
        return `OK ${file.path} (${file.providerId})`
      }

      return `FAIL ${file.path}\n${file.errors.map((error) => `  - ${error}`).join('\n')}`
    }),
  ]

  return lines.join('\n')
}

async function collectManifestPath(path: string, files: string[]): Promise<void> {
  const pathStat = await stat(path)

  if (pathStat.isFile()) {
    if (path.endsWith('provider.adapter.json')) {
      files.push(path)
    }
    return
  }

  if (!pathStat.isDirectory()) {
    return
  }

  const entries = await readdir(path, { withFileTypes: true })
  await Promise.all(
    entries.map((entry) => collectManifestPath(join(path, entry.name), files)),
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
  console.log(`Validate Novel Engine provider adapter manifests.

Usage:
  npm run providers:check
  npm run providers:check -- providers
  npm run providers:check -- --json /path/to/providers

Only files named provider.adapter.json are checked.
`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  const report = await checkProviderAdapters(options.paths)
  console.log(
    options.json ? JSON.stringify(report, null, 2) : formatProviderCheckReport(report),
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
