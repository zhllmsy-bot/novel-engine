import dialoguePolishSkill from '../../examples/skills/xuanhuan-dialogue-polish.skill.yaml?raw'
import foreshadowingThreadSkill from '../../examples/skills/xuanhuan-foreshadowing-thread.skill.yaml?raw'
import { isTauriRuntime } from '../platform/runtime'
import { scanProjectSkills } from '../platform/tauriProject'
import type { SkillManifest } from '../types/domain'
import { builtinSkills } from './builtinSkills'
import { parseSkillManifest } from './skillManifest'

export type SkillCatalogEntry = {
  manifest: SkillManifest
  source: SkillCatalogEntrySource
  path?: string
}

export type SkillCatalogEntrySource =
  | 'builtin'
  | 'bundled_yaml'
  | 'project_yaml'

export type SkillCatalogSourceFilter = 'all' | SkillCatalogEntrySource

export type SkillCatalog = {
  skills: SkillCatalogEntry[]
  errors: string[]
}

export type SkillCatalogSourceSummary = Record<SkillCatalogEntrySource, number> & {
  all: number
}

export type SkillYamlSource = {
  path: string
  source: string
  scope?: 'bundled' | 'project'
}

type ProjectSkillScanner = typeof scanProjectSkills

type LoadProjectSkillCatalogOptions = {
  projectRoot?: string
  isTauri?: () => boolean
  scanSkills?: ProjectSkillScanner
}

const bundledYamlSkillSources: SkillYamlSource[] = [
  {
    path: 'examples/skills/xuanhuan-dialogue-polish.skill.yaml',
    source: dialoguePolishSkill,
  },
  {
    path: 'examples/skills/xuanhuan-foreshadowing-thread.skill.yaml',
    source: foreshadowingThreadSkill,
  },
]

export function loadSkillCatalog(): SkillCatalog {
  return buildSkillCatalog(getBuiltinSkillEntries(), bundledYamlSkillSources)
}

export async function loadProjectSkillCatalog(
  options: LoadProjectSkillCatalogOptions,
): Promise<SkillCatalog> {
  const isTauri = options.isTauri || isTauriRuntime
  const scanSkills = options.scanSkills || scanProjectSkills

  if (!options.projectRoot || !isTauri()) {
    return loadSkillCatalog()
  }

  try {
    const projectSkillSources = (await scanSkills(options.projectRoot)).map(
      (skillFile) => ({
        path: skillFile.file_path,
        source: skillFile.content,
        scope: 'project' as const,
      }),
    )

    return buildSkillCatalog(getBuiltinSkillEntries(), [
      ...bundledYamlSkillSources,
      ...projectSkillSources,
    ])
  } catch (error) {
    const catalog = loadSkillCatalog()

    return {
      ...catalog,
      errors: [
        ...catalog.errors,
        `skills/: ${error instanceof Error ? error.message : String(error)}`,
      ],
    }
  }
}

export function buildSkillCatalog(
  builtinEntries: SkillCatalogEntry[],
  yamlSources: SkillYamlSource[],
): SkillCatalog {
  const entries = new Map<string, SkillCatalogEntry>()
  const errors: string[] = []
  const seenBySource = new Map<string, string>()

  for (const entry of builtinEntries) {
    entries.set(entry.manifest.id, entry)
    seenBySource.set(`${entry.source}:${entry.manifest.id}`, entry.path || entry.source)
  }

  for (const yamlSource of yamlSources) {
    const result = parseSkillManifest(yamlSource.source)

    if (!result.ok) {
      errors.push(`${yamlSource.path}: ${result.errors.join(' ')}`)
      continue
    }

    const source = yamlSource.scope === 'project' ? 'project_yaml' : 'bundled_yaml'
    const sourceKey = `${source}:${result.manifest.id}`
    const previousPath = seenBySource.get(sourceKey)
    if (previousPath) {
      errors.push(
        `${yamlSource.path}: duplicate Skill id ${result.manifest.id} already declared in ${previousPath}.`,
      )
    }
    seenBySource.set(sourceKey, yamlSource.path)

    entries.set(result.manifest.id, {
      manifest: result.manifest,
      source,
      path: yamlSource.path,
    })
  }

  return {
    skills: [...entries.values()].toSorted((left, right) =>
      left.manifest.name.localeCompare(right.manifest.name, 'zh-Hans-CN'),
    ),
    errors,
  }
}

function getBuiltinSkillEntries(): SkillCatalogEntry[] {
  return builtinSkills.map((manifest) => ({ manifest, source: 'builtin' }))
}

export function findRewriteSkill(catalog: SkillCatalog) {
  return catalog.skills.find(
    (entry) => entry.manifest.outputMode === 'rewrite_patch',
  )?.manifest
}

export function findChapterSummarySkill(catalog: SkillCatalog) {
  return catalog.skills.find(
    (entry) => entry.manifest.outputMode === 'chapter_summary',
  )?.manifest
}

export function formatSkillCatalogSource(source: SkillCatalogEntrySource) {
  const labels: Record<SkillCatalogEntrySource, string> = {
    builtin: '内置',
    bundled_yaml: '示例',
    project_yaml: '项目',
  }

  return labels[source]
}

export function describeSkillCatalogSource(entry: SkillCatalogEntry) {
  const label = formatSkillCatalogSource(entry.source)

  return entry.path ? `${label} · ${entry.path}` : label
}

export function summarizeSkillCatalogSources(
  entries: SkillCatalogEntry[],
): SkillCatalogSourceSummary {
  const summary: SkillCatalogSourceSummary = {
    all: entries.length,
    builtin: 0,
    bundled_yaml: 0,
    project_yaml: 0,
  }

  entries.forEach((entry) => {
    summary[entry.source] += 1
  })

  return summary
}

export function filterSkillCatalogEntriesBySource(
  entries: SkillCatalogEntry[],
  source: SkillCatalogSourceFilter,
): SkillCatalogEntry[] {
  if (source === 'all') return entries

  return entries.filter((entry) => entry.source === source)
}
