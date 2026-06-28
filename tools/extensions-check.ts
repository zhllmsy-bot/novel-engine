#!/usr/bin/env node
import { resolve } from 'node:path'
import {
  checkProviderAdapters,
  formatProviderCheckReport,
  type ProviderCheckReport,
} from './provider-check.ts'
import {
  checkPublisherAdapters,
  formatPublisherCheckReport,
  type PublisherCheckReport,
} from './publisher-check.ts'
import {
  checkSkillManifestFile,
  checkSkillManifests,
  formatSkillCheckReport,
  type SkillCheckReport,
} from './skill-check.ts'

export type ExtensionCheckReport = {
  ok: boolean
  checked: number
  passed: number
  failed: number
  skills: SkillCheckReport
  providers: ProviderCheckReport
  publishers: PublisherCheckReport
}

type CliOptions = {
  json: boolean
  help: boolean
}

const skillPaths = [
  'examples/skills',
] as const

const skillTemplatePaths = ['examples/skills/skill-template.yaml'] as const

const providerPaths = [
  'providers',
  'examples/adapters/provider-adapter-template',
] as const

const publisherPaths = [
  'publisher/adapters',
  'examples/adapters/publisher-adapter-template',
] as const

export async function checkExtensions(): Promise<ExtensionCheckReport> {
  const [skills, providers, publishers] = await Promise.all([
    checkCommunitySkillManifests(),
    checkProviderAdapters([...providerPaths]),
    checkPublisherAdapters([...publisherPaths]),
  ])
  const checked = skills.checked + providers.checked + publishers.checked
  const failed = skills.failed + providers.failed + publishers.failed

  return {
    ok: failed === 0,
    checked,
    passed: checked - failed,
    failed,
    skills,
    providers,
    publishers,
  }
}

async function checkCommunitySkillManifests(): Promise<SkillCheckReport> {
  const [bundledSkills, templateFiles] = await Promise.all([
    checkSkillManifests([...skillPaths]),
    Promise.all(
      skillTemplatePaths.map((path) => checkSkillManifestFile(resolve(path))),
    ),
  ])
  const files = [...bundledSkills.files, ...templateFiles].toSorted((left, right) =>
    left.path.localeCompare(right.path),
  )
  const failed = files.filter((file) => !file.ok).length

  return {
    checked: files.length,
    passed: files.length - failed,
    failed,
    files,
  }
}

export function formatExtensionCheckReport(report: ExtensionCheckReport): string {
  return [
    `Extension check: ${report.ok ? 'OK' : 'FAILED'} (${report.passed}/${report.checked} passed)`,
    formatSkillCheckReport(report.skills),
    formatProviderCheckReport(report.providers),
    formatPublisherCheckReport(report.publishers),
  ].join('\n\n')
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    json: false,
    help: false,
  }

  for (const arg of args) {
    if (arg === '--json') {
      options.json = true
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    } else {
      throw new Error(`unknown argument: ${arg}`)
    }
  }

  return options
}

function printHelp() {
  console.log(`Validate all Novel Engine community extension manifests.

Usage:
  npm run extensions:check
  npm run extensions:check -- --json

Checks bundled examples, contribution templates, provider adapters, and publisher adapters.
`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  const report = await checkExtensions()
  console.log(
    options.json
      ? JSON.stringify(report, null, 2)
      : formatExtensionCheckReport(report),
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
