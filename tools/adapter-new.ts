#!/usr/bin/env node
import { copyFile, mkdir, writeFile } from 'node:fs/promises'
import { dirname, isAbsolute, relative, resolve } from 'node:path'
import { parseProviderAdapterManifest } from '../src/ai/providerManifest.ts'
import { parsePublisherAdapterManifest } from '../publisher/core/adapterManifest.ts'

type AdapterKind = 'provider' | 'publisher'

type ProviderAdapterKind = 'local' | 'openai-compatible'

type AdapterNewOptions = {
  type: AdapterKind
  id: string
  name: string
  outputPath: string
  projectRoot?: string
  providerKind: ProviderAdapterKind
  force: boolean
  help: boolean
}

const adapterKinds = new Set<AdapterKind>(['provider', 'publisher'])
const providerKinds = new Set<ProviderAdapterKind>(['local', 'openai-compatible'])

export function buildAdapterTemplate(options: AdapterNewOptions) {
  return options.type === 'provider'
    ? buildProviderAdapterTemplate(options)
    : buildPublisherAdapterTemplate(options)
}

function buildProviderAdapterTemplate(options: AdapterNewOptions) {
  const configFields =
    options.providerKind === 'openai-compatible'
      ? ['baseUrl', 'model', 'apiKey']
      : ['baseUrl', 'model']

  return `${JSON.stringify(
    {
      $schema: schemaReferenceForOutputPath(
        options.outputPath,
        'schemas/provider-adapter.schema.json',
        options.projectRoot,
      ),
      id: options.id,
      label: options.name,
      kind: options.providerKind,
      description:
        '描述这个模型网关或本地模型服务的用途、兼容范围和限制。',
      status: 'planned',
      config_fields: configFields,
      capabilities: [
        options.providerKind === 'openai-compatible'
          ? 'OpenAI-compatible'
          : 'local model',
        'BYO-Key',
        'JSON response contract',
      ],
    },
    null,
    2,
  )}\n`
}

function buildPublisherAdapterTemplate(options: AdapterNewOptions) {
  const adapterRoot = options.projectRoot
    ? `publisher/adapters/${options.id}`
    : `publisher/adapters/${options.id}`

  return `${JSON.stringify(
    {
      $schema: schemaReferenceForOutputPath(
        options.outputPath,
        'schemas/publisher-adapter.schema.json',
        options.projectRoot,
      ),
      id: options.id,
      display_name: options.name,
      description:
        '描述这个上传目标、账号边界、支持的章节来源和当前实现状态。',
      status: 'planned',
      config_path: `${adapterRoot}/.env.example`,
      runtime: {
        editor_dry_run: false,
      },
      capabilities: ['独立 .env 配置', 'dry-run 优先', '人工确认后上传'],
    },
    null,
    2,
  )}\n`
}

export async function createAdapterManifest(options: AdapterNewOptions) {
  const source = buildAdapterTemplate(options)

  if (options.type === 'provider') {
    const parsed = parseProviderAdapterManifest(source)
    if (!parsed.ok) {
      throw new Error(
        `Generated provider adapter did not validate:\n${parsed.errors.join('\n')}`,
      )
    }
  } else {
    const parsed = parsePublisherAdapterManifest(source)
    if (!parsed.ok) {
      throw new Error(
        `Generated publisher adapter did not validate:\n${parsed.errors.join('\n')}`,
      )
    }
  }

  await ensureProjectAdapterSchema(options)
  await mkdir(dirname(options.outputPath), { recursive: true })
  await writeFile(options.outputPath, source, {
    encoding: 'utf8',
    flag: options.force ? 'w' : 'wx',
  })

  return {
    path: options.outputPath,
    adapterId: options.id,
    type: options.type,
  }
}

export function parseAdapterNewArgs(args: string[]): AdapterNewOptions {
  const options: Partial<AdapterNewOptions> = {
    type: 'provider',
    providerKind: 'openai-compatible',
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
    } else if (arg === '--type') {
      options.type = parseAdapterKind(requiredValue(arg, next))
      index += 1
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
    } else if (arg === '--provider-kind') {
      options.providerKind = parseProviderKind(requiredValue(arg, next))
      index += 1
    } else {
      throw new Error(`unknown argument: ${arg}`)
    }
  }

  const id = options.id || (options.help ? 'community-adapter' : undefined)
  if (!id) {
    throw new Error('--id is required.')
  }

  const name = options.name || (options.help ? 'Community Adapter' : undefined)
  if (!name) {
    throw new Error('--name is required.')
  }

  return {
    type: options.type || 'provider',
    id,
    name,
    outputPath: resolveAdapterOutputPath({
      type: options.type || 'provider',
      id,
      outputPath: options.outputPath,
      projectRoot: options.projectRoot,
    }),
    projectRoot: options.projectRoot ? resolve(options.projectRoot) : undefined,
    providerKind: options.providerKind || 'openai-compatible',
    force: Boolean(options.force),
    help: Boolean(options.help),
  }
}

function resolveAdapterOutputPath({
  type,
  id,
  outputPath,
  projectRoot,
}: {
  type: AdapterKind
  id: string
  outputPath?: string
  projectRoot?: string
}) {
  if (outputPath) {
    if (isAbsolute(outputPath)) return outputPath
    return resolve(projectRoot || '.', outputPath)
  }

  const baseRoot = projectRoot ? resolve(projectRoot) : resolve('.')
  const relativePath =
    type === 'provider'
      ? ['providers', id, 'provider.adapter.json']
      : ['publisher', 'adapters', id, 'publisher.adapter.json']

  return resolve(baseRoot, ...relativePath)
}

async function ensureProjectAdapterSchema(options: AdapterNewOptions) {
  if (!options.projectRoot) return

  const schemaPath =
    options.type === 'provider'
      ? 'schemas/provider-adapter.schema.json'
      : 'schemas/publisher-adapter.schema.json'
  const targetPath = projectSchemaPath(options.projectRoot, schemaPath)

  await mkdir(dirname(targetPath), { recursive: true })
  await copyFile(resolve(schemaPath), targetPath)
}

function schemaReferenceForOutputPath(
  outputPath: string,
  schemaPath: string,
  projectRoot?: string,
) {
  const targetSchemaPath = projectRoot
    ? projectSchemaPath(projectRoot, schemaPath)
    : resolve(schemaPath)
  const relativePath = relative(dirname(resolve(outputPath)), targetSchemaPath)
    .replaceAll('\\', '/')

  return relativePath.startsWith('.') ? relativePath : `./${relativePath}`
}

function projectSchemaPath(projectRoot: string, schemaPath: string) {
  return resolve(projectRoot, '.novel', 'schemas', schemaPath.split('/').at(-1) || '')
}

function requiredValue(flag: string, value?: string) {
  if (!value || value.startsWith('--')) {
    throw new Error(`${flag} requires a value.`)
  }

  return value
}

function parseAdapterKind(value: string): AdapterKind {
  if (!adapterKinds.has(value as AdapterKind)) {
    throw new Error(`--type must be one of: ${[...adapterKinds].join(', ')}.`)
  }

  return value as AdapterKind
}

function parseProviderKind(value: string): ProviderAdapterKind {
  if (!providerKinds.has(value as ProviderAdapterKind)) {
    throw new Error(
      `--provider-kind must be one of: ${[...providerKinds].join(', ')}.`,
    )
  }

  return value as ProviderAdapterKind
}

function printHelp() {
  console.log(`Create a validated Novel Engine adapter manifest.

Usage:
  npm run adapters:new -- --type provider --id community-gateway --name "Community Gateway"
  npm run adapters:new -- --type provider --project /path/to/MyNovel --id local-qwen --name "Local Qwen" --provider-kind local
  npm run adapters:new -- --type publisher --id royalroad --name "Royal Road"
  npm run adapters:new -- --type publisher --project /path/to/MyNovel --id fanqie-local --name "番茄本地上传"

Options:
  --type <type>              provider or publisher. Defaults to provider.
  --id <id>                  Required. Lowercase id such as community-gateway.
  --name <name>              Required. Display name shown in the editor.
  --out <path>               Output path. Relative paths resolve from --project when provided.
  --project <path>           Novel project root for project-local adapter manifests.
  --provider-kind <kind>     openai-compatible or local. Provider only.
  --force                    Overwrite an existing file.
`)
}

async function main() {
  const options = parseAdapterNewArgs(process.argv.slice(2))

  if (options.help) {
    printHelp()
    return
  }

  const result = await createAdapterManifest(options)
  console.log(`Created ${result.path} (${result.adapterId})`)
  const checkCommand =
    options.type === 'provider'
      ? `npm run providers:check -- ${dirname(result.path)}`
      : `npm run publisher:check -- ${dirname(result.path)}`
  console.log(
    'Next: ' +
      (options.projectRoot
        ? `npm run project:check -- ${options.projectRoot}`
        : checkCommand),
  )
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  })
}
