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
  benchmarks: WorkspaceBenchmarkReport[]
}

export type WorkspaceBenchmarkReport = {
  projectPath: string
  memory: MemoryEvalReport
}

type CliOptions = {
  projectPath: string
  benchmarkPaths: string[]
  json: boolean
  help: boolean
}

const defaultBenchmarkPaths = ['examples/long-memory-benchmark']

export async function checkWorkspace(
  projectPath = 'examples/demo-novel',
  options: {
    benchmarkPaths?: string[]
  } = {},
): Promise<WorkspaceCheckReport> {
  const benchmarkPaths = options.benchmarkPaths || []
  const [project, memory, extensions, ...benchmarkReports] = await Promise.all([
    checkNovelProject(projectPath),
    evaluateNarrativeMemory({ rootPath: projectPath }),
    checkExtensions(),
    ...benchmarkPaths.map((path) => evaluateNarrativeMemory({ rootPath: path })),
  ])
  const benchmarks = benchmarkReports.map((benchmark, index) => ({
    projectPath: benchmarkPaths[index],
    memory: benchmark,
  }))

  return {
    ok:
      project.ok &&
      memory.ok &&
      extensions.ok &&
      benchmarks.every((benchmark) => benchmark.memory.ok),
    projectPath,
    project,
    memory,
    extensions,
    benchmarks,
  }
}

export function formatWorkspaceCheckReport(report: WorkspaceCheckReport): string {
  return [
    `Workspace check: ${report.ok ? 'OK' : 'FAILED'}`,
    `Project path: ${report.projectPath}`,
    formatProjectCheckReport(report.project),
    formatMemoryEvalReport(report.memory),
    formatExtensionCheckReport(report.extensions),
    ...report.benchmarks.map((benchmark) =>
      [
        `Benchmark memory eval: ${benchmark.memory.ok ? 'OK' : 'FAILED'}`,
        `Benchmark path: ${benchmark.projectPath}`,
        formatMemoryEvalReport(benchmark.memory),
      ].join('\n'),
    ),
  ].join('\n\n')
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    projectPath: 'examples/demo-novel',
    benchmarkPaths: [],
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
    } else if (arg === '--benchmark') {
      options.benchmarkPaths = defaultBenchmarkPaths
    } else if (arg === '--benchmark-project') {
      if (!next || next.startsWith('--')) {
        throw new Error('--benchmark-project requires a value.')
      }
      options.benchmarkPaths.push(next)
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
  npm run workspace:check -- --benchmark
  npm run workspace:check -- --benchmark-project examples/long-memory-benchmark
  npm run workspace:check -- --json --project /path/to/MyNovel

Runs project:check, memory:eval, and extensions:check through the shared runtime
functions so contributors have one local/CI gate before opening a PR.
Use --benchmark to include the repository long-memory benchmark, or
--benchmark-project to add a specific recall benchmark corpus.
`)
}

async function main() {
  const options = parseArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  const report = await checkWorkspace(options.projectPath, {
    benchmarkPaths: options.benchmarkPaths,
  })
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
