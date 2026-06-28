import mockProviderManifestSource from '../../providers/mock/provider.adapter.json?raw'
import openAIProviderManifestSource from '../../providers/openai/provider.adapter.json?raw'
import { isTauriRuntime } from '../platform/runtime'
import { scanProjectProviderAdapters } from '../platform/tauriProject'
import {
  parseProviderAdapterManifest,
  type ProviderAdapterManifest,
} from './providerManifest'

export type ProviderAdapterSource = {
  path: string
  source: string
  sourceKind: 'bundled' | 'project'
}

export type ProviderAdapterCatalog = {
  adapters: ProviderAdapterManifest[]
  errors: string[]
}

type ProjectProviderAdapterScanner = typeof scanProjectProviderAdapters

type LoadProjectProviderAdapterCatalogOptions = {
  projectRoot?: string
  isTauri?: () => boolean
  scanAdapters?: ProjectProviderAdapterScanner
}

const bundledProviderAdapterSources: ProviderAdapterSource[] = [
  {
    path: 'providers/mock/provider.adapter.json',
    source: mockProviderManifestSource,
    sourceKind: 'bundled',
  },
  {
    path: 'providers/openai/provider.adapter.json',
    source: openAIProviderManifestSource,
    sourceKind: 'bundled',
  },
]

export function listProviderAdapterManifests(): ProviderAdapterManifest[] {
  const catalog = buildProviderAdapterCatalog(bundledProviderAdapterSources)

  if (catalog.errors.length > 0) {
    throw new Error(`Invalid bundled provider adapter: ${catalog.errors.join(' ')}`)
  }

  return catalog.adapters
}

export async function loadProjectProviderAdapterCatalog(
  options: LoadProjectProviderAdapterCatalogOptions,
): Promise<ProviderAdapterCatalog> {
  const isTauri = options.isTauri || isTauriRuntime
  const scanAdapters = options.scanAdapters || scanProjectProviderAdapters

  if (!options.projectRoot || !isTauri()) {
    return buildProviderAdapterCatalog(bundledProviderAdapterSources)
  }

  try {
    const projectAdapterSources = (await scanAdapters(options.projectRoot)).map(
      (adapterFile) => ({
        path: adapterFile.file_path,
        source: adapterFile.content,
        sourceKind: 'project' as const,
      }),
    )

    return buildProviderAdapterCatalog([
      ...bundledProviderAdapterSources,
      ...projectAdapterSources,
    ])
  } catch (error) {
    const catalog = buildProviderAdapterCatalog(bundledProviderAdapterSources)

    return {
      ...catalog,
      errors: [
        ...catalog.errors,
        `providers/: ${error instanceof Error ? error.message : String(error)}`,
      ],
    }
  }
}

export function buildProviderAdapterCatalog(
  sources: ProviderAdapterSource[],
): ProviderAdapterCatalog {
  const adapters = new Map<string, ProviderAdapterManifest>()
  const errors: string[] = []
  const seenBySource = new Map<string, string>()

  for (const source of sources) {
    const result = parseProviderAdapterManifest(source.source)

    if (!result.ok) {
      errors.push(`${source.path}: ${result.errors.join(' ')}`)
      continue
    }

    const sourceKey = `${source.sourceKind}:${result.manifest.id}`
    const previousPath = seenBySource.get(sourceKey)
    if (previousPath) {
      errors.push(
        `${source.path}: duplicate provider adapter id ${result.manifest.id} already declared in ${previousPath}.`,
      )
    }
    seenBySource.set(sourceKey, source.path)

    adapters.set(result.manifest.id, {
      ...result.manifest,
      sourceKind: source.sourceKind,
      path: source.path,
    })
  }

  return {
    adapters: [...adapters.values()],
    errors,
  }
}
