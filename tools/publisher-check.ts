#!/usr/bin/env node
import { readFile } from 'node:fs/promises'
import { parsePublisherAdapterManifest } from '../publisher/core/adapterManifest.ts'
import { collectPublisherAdapterManifestFiles } from '../publisher/core/adapterManifestLoader.ts'

export type PublisherCheckFileResult = {
  path: string
  ok: boolean
  adapterId?: string
  errors: string[]
}

export type PublisherCheckReport = {
  checked: number
  passed: number
  failed: number
  files: PublisherCheckFileResult[]
}

type CliOptions = {
  paths: string[]
  json: boolean
  help: boolean
}

export async function checkPublisherAdapters(
  inputPaths: string[],
): Promise<PublisherCheckReport> {
  const paths = inputPaths.length > 0 ? inputPaths : ['publisher/adapters']
  const files = (
    await Promise.all(paths.map((path) => collectPublisherAdapterManifestFiles(path)))
  )
    .flat()
    .toSorted((left, right) => left.localeCompare(right))
  const results = await Promise.all(files.map(checkPublisherAdapterFile))
  markDuplicatePublisherIds(results)
  const failed = results.filter((result) => !result.ok).length

  return {
    checked: results.length,
    passed: results.length - failed,
    failed,
    files: results,
  }
}

function markDuplicatePublisherIds(results: PublisherCheckFileResult[]) {
  const seen = new Map<string, string>()

  for (const result of results) {
    if (!result.ok || !result.adapterId) continue

    const previousPath = seen.get(result.adapterId)
    if (previousPath) {
      result.ok = false
      result.errors.push(
        `duplicate publisher adapter id ${result.adapterId} already declared in ${previousPath}.`,
      )
      continue
    }

    seen.set(result.adapterId, result.path)
  }
}

export async function checkPublisherAdapterFile(
  path: string,
): Promise<PublisherCheckFileResult> {
  const result = parsePublisherAdapterManifest(await readFile(path, 'utf8'))

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
    adapterId: result.manifest.id,
    errors: [],
  }
}

export function formatPublisherCheckReport(report: PublisherCheckReport): string {
  const lines = [
    `Publisher adapter check: ${report.passed}/${report.checked} passed`,
    ...report.files.map((file) => {
      if (file.ok) {
        return `OK ${file.path} (${file.adapterId})`
      }

      return `FAIL ${file.path}\n${file.errors.map((error) => `  - ${error}`).join('\n')}`
    }),
  ]

  return lines.join('\n')
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
  console.log(`Validate Novel Engine publisher adapter manifests.

Usage:
  npm run publisher:check
  npm run publisher:check -- publisher/adapters
  npm run publisher:check -- --json /path/to/adapters

Only files named publisher.adapter.json are checked.
`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  const report = await checkPublisherAdapters(options.paths)
  console.log(
    options.json ? JSON.stringify(report, null, 2) : formatPublisherCheckReport(report),
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
