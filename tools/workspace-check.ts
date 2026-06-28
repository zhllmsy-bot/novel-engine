#!/usr/bin/env node
import {
  checkExtensions,
  formatExtensionCheckReport,
  type ExtensionCheckReport,
} from './extensions-check.ts'
import {
  evaluateNarrativeMemory,
  formatMemoryEvalReport,
  type MemoryEvalReport,
} from './memory-eval.ts'
import {
  checkNovelProject,
  formatProjectCheckReport,
  type ProjectCheckReport,
} from './project-check.ts'

export type WorkspaceCheckReport = {
  ok: boolean
  projectPath: string
  project: ProjectCheckReport
  memory: MemoryEvalReport
  extensions: ExtensionCheckReport
}

type CliOptions = {
  projectPath: string
  json: boolean
  help: boolean
}

export async function checkWorkspace(
  projectPath = 'examples/demo-novel',
): Promise<WorkspaceCheckReport> {
  const [project, memory, extensions] = await Promise.all([
    checkNovelProject(projectPath),
    evaluateNarrativeMemory({ rootPath: projectPath }),
    checkExtensions(),
  ])

  return {
    ok: project.ok && memory.ok && extensions.ok,
    projectPath,
    project,
    memory,
    extensions,
  }
}

export function formatWorkspaceCheckReport(report: WorkspaceCheckReport): string {
  return [
    `Workspace check: ${report.ok ? 'OK' : 'FAILED'}`,
    `Project path: ${report.projectPath}`,
    formatProjectCheckReport(report.project),
    formatMemoryEvalReport(report.memory),
    formatExtensionCheckReport(report.extensions),
  ].join('\n\n')
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    projectPath: 'examples/demo-novel',
    json: false,
    help: false,
  }

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]
    const next = args[index + 1]

    if (arg === '--json') {
      options.json = true
    } else if (arg === '--help' || arg === '-h') {
      options.help = true
    } else if (arg === '--project') {
      if (!next || next.startsWith('--')) {
        throw new Error('--project requires a value.')
      }
      options.projectPath = next
      index += 1
    } else {
      options.projectPath = arg
    }
  }

  return options
}

function printHelp() {
  console.log(`Validate the Novel Engine workspace and a representative project.

Usage:
  npm run workspace:check
  npm run workspace:check -- --project examples/demo-novel
  npm run workspace:check -- --json --project /path/to/MyNovel

Runs project:check, memory:eval, and extensions:check through the shared runtime
functions so contributors have one local/CI gate before opening a PR.
`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  const report = await checkWorkspace(options.projectPath)
  console.log(
    options.json
      ? JSON.stringify(report, null, 2)
      : formatWorkspaceCheckReport(report),
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
