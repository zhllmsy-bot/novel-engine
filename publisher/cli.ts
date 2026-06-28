#!/usr/bin/env node
import { access } from 'node:fs/promises'
import { resolve } from 'node:path'
import {
  createDryRunAdapter,
  createFanqieConfig,
  loadEnvFile,
  runPublishPlan,
} from './core/index.ts'

type CliOptions = {
  adapter: 'dry-run'
  envPath?: string
  chaptersDir?: string
  progressPath?: string
  count?: number
  all: boolean
  startFrom: number
  record: boolean
  help: boolean
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  const envPath = await findEnvPath(options.envPath)
  const env = envPath ? await loadEnvFile(envPath) : {}
  const config = createFanqieConfig(env, envPath || resolve('.env'))
  const adapter = createDryRunAdapter()
  const limit = options.all ? undefined : options.count || 1
  const report = await runPublishPlan({
    chaptersDir: options.chaptersDir || config.chaptersDir,
    progressPath: options.progressPath || config.progressPath,
    adapter,
    startFrom: options.startFrom,
    limit,
    recordSuccess: options.record,
  })

  console.log(
    JSON.stringify(
      {
        bookId: config.bookId,
        dryRun: true,
        recordProgress: options.record,
        ...report,
      },
      null,
      2,
    ),
  )
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    adapter: 'dry-run',
    all: false,
    startFrom: 1,
    record: false,
    help: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    switch (arg) {
      case '--adapter':
        options.adapter = readValue(args, ++index, arg) as 'dry-run'
        if (options.adapter !== 'dry-run') {
          throw new Error('Only --adapter dry-run is implemented in this skeleton')
        }
        break
      case '--env':
        options.envPath = resolve(readValue(args, ++index, arg))
        break
      case '--chapters-dir':
        options.chaptersDir = resolve(readValue(args, ++index, arg))
        break
      case '--progress':
        options.progressPath = resolve(readValue(args, ++index, arg))
        break
      case '--count':
        options.count = Number(readValue(args, ++index, arg))
        break
      case '--all':
        options.all = true
        break
      case '--start-from':
        options.startFrom = Number(readValue(args, ++index, arg))
        break
      case '--record':
        options.record = true
        break
      case '--help':
      case '-h':
        options.help = true
        break
      default:
        throw new Error(`Unknown option: ${arg}`)
    }
  }

  return options
}

async function findEnvPath(explicitPath?: string): Promise<string | undefined> {
  const candidates = explicitPath
    ? [explicitPath]
    : [
        resolve('publisher/adapters/fanqie/.env'),
        resolve('.env'),
        resolve('publisher/adapters/fanqie/.env.example'),
      ]

  for (const candidate of candidates) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // Try the next candidate.
    }
  }

  return undefined
}

function readValue(args: string[], index: number, option: string): string {
  const value = args[index]
  if (!value) {
    throw new Error(`${option} requires a value`)
  }
  return value
}

function printHelp(): void {
  console.log(`Standalone publisher dry-run

Usage:
  npm run publisher:dry-run -- --count 3
  node --experimental-strip-types publisher/cli.ts --env publisher/adapters/fanqie/.env.example --all

Options:
  --adapter dry-run       Publisher adapter. Only dry-run exists in this skeleton.
  --env PATH              Env file path. Defaults to publisher/adapters/fanqie/.env, .env, then .env.example.
  --chapters-dir PATH     Override chapter Markdown directory.
  --progress PATH         Override progress JSON path.
  --count N               Publish N pending chapters. Defaults to 1.
  --all                   Publish every pending chapter.
  --start-from N          Ignore chapters before N. Defaults to 1.
  --record                Write dry-run outcomes to progress JSON. Only success is treated as published.
`)
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(message)
  process.exitCode = 1
})
