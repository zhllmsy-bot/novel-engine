import { createDryRunAdapter } from '../../publisher/core/adapters/dryRunAdapter'
import dryRunAdapterManifestSource from '../../publisher/adapters/dry-run/publisher.adapter.json?raw'
import fanqieAdapterManifestSource from '../../publisher/adapters/fanqie/publisher.adapter.json?raw'
import { parsePublisherAdapterManifest } from '../../publisher/core/adapterManifest'
import type {
  PublishChapterPayload,
  PublishRunReport,
} from '../../publisher/core/types'
import { isTauriRuntime } from '../platform/runtime'
import { scanProjectPublisherAdapters } from '../platform/tauriProject'
import type { ChapterDraftStore } from '../project/chapterDraftStore'
import type { NovelProject, ProjectChapter } from '../project/projectTypes'

export type EditorPublisherAdapterStatus = 'available' | 'configured' | 'planned'

export type EditorPublisherAdapterInfo = {
  id: string
  displayName: string
  description: string
  status: EditorPublisherAdapterStatus
  source?: 'bundled' | 'project'
  path?: string
  configPath?: string
  capabilities: string[]
  runtime: {
    editorDryRun: boolean
  }
}

export type EditorPublishPlan = {
  scanned: number
  skipped: number
  pending: PublishChapterPayload[]
}

export type EditorPublishReport = PublishRunReport

export type EditorPublisherReadinessCheck = {
  id:
    | 'manifest-dry-run'
    | 'editor-runtime'
    | 'pending-chapter'
    | 'config-path'
  label: string
  ready: boolean
  detail: string
  optional?: boolean
}

export type EditorPublisherReadinessAudit = {
  adapter: EditorPublisherAdapterInfo
  ready: boolean
  canDryRun: boolean
  hasPendingChapter: boolean
  reasons: string[]
  checks: EditorPublisherReadinessCheck[]
}

export type PublisherAdapterSource = {
  path: string
  source: string
  sourceKind?: 'bundled' | 'project'
}

type ProjectPublisherAdapterScanner = typeof scanProjectPublisherAdapters

type LoadProjectPublisherAdapterCatalogOptions = {
  projectRoot?: string
  isTauri?: () => boolean
  scanAdapters?: ProjectPublisherAdapterScanner
}

const bundledPublisherAdapterSources: PublisherAdapterSource[] = [
  {
    path: 'publisher/adapters/dry-run/publisher.adapter.json',
    source: dryRunAdapterManifestSource,
    sourceKind: 'bundled',
  },
  {
    path: 'publisher/adapters/fanqie/publisher.adapter.json',
    source: fanqieAdapterManifestSource,
    sourceKind: 'bundled',
  },
]

export function listEditorPublisherAdapters(): EditorPublisherAdapterInfo[] {
  return buildEditorPublisherAdapterCatalog(bundledPublisherAdapterSources).adapters
}

export type EditorPublisherAdapterCatalog = {
  adapters: EditorPublisherAdapterInfo[]
  errors: string[]
}

export async function loadProjectPublisherAdapterCatalog(
  options: LoadProjectPublisherAdapterCatalogOptions,
): Promise<EditorPublisherAdapterCatalog> {
  const isTauri = options.isTauri || isTauriRuntime
  const scanAdapters = options.scanAdapters || scanProjectPublisherAdapters

  if (!options.projectRoot || !isTauri()) {
    return buildEditorPublisherAdapterCatalog(bundledPublisherAdapterSources)
  }

  try {
    const projectAdapterSources = (await scanAdapters(options.projectRoot)).map(
      (adapterFile) => ({
        path: adapterFile.file_path,
        source: adapterFile.content,
        sourceKind: 'project' as const,
      }),
    )

    return buildEditorPublisherAdapterCatalog([
      ...bundledPublisherAdapterSources,
      ...projectAdapterSources,
    ])
  } catch (error) {
    const catalog = buildEditorPublisherAdapterCatalog(bundledPublisherAdapterSources)

    return {
      ...catalog,
      errors: [
        ...catalog.errors,
        `publisher/adapters/: ${
          error instanceof Error ? error.message : String(error)
        }`,
      ],
    }
  }
}

export function buildEditorPublisherAdapterCatalog(
  sources: PublisherAdapterSource[],
): EditorPublisherAdapterCatalog {
  const adapters = new Map<string, EditorPublisherAdapterInfo>()
  const errors: string[] = []
  const seenBySource = new Map<string, string>()

  for (const source of sources) {
    const result = parsePublisherAdapterManifest(source.source)

    if (!result.ok) {
      errors.push(`${source.path}: ${result.errors.join(' ')}`)
      continue
    }

    const sourceKind = source.sourceKind || 'project'
    const sourceKey = `${sourceKind}:${result.manifest.id}`
    const previousPath = seenBySource.get(sourceKey)
    if (previousPath) {
      errors.push(
        `${source.path}: duplicate publisher adapter id ${result.manifest.id} already declared in ${previousPath}.`,
      )
    }
    seenBySource.set(sourceKey, source.path)

    adapters.set(result.manifest.id, {
      ...result.manifest,
      source: sourceKind,
      path: source.path,
    })
  }

  return {
    adapters: [...adapters.values()].toSorted((left, right) =>
      left.displayName.localeCompare(right.displayName, 'zh-Hans-CN'),
    ),
    errors,
  }
}

export function findEditorPublisherAdapter(
  adapterId: string,
  adapters = listEditorPublisherAdapters(),
): EditorPublisherAdapterInfo {
  const adapter = adapters.find((candidate) => candidate.id === adapterId)

  if (!adapter) {
    throw new Error(`Unknown publisher adapter: ${adapterId}`)
  }

  return adapter
}

export function getDefaultEditorDryRunAdapterId(
  adapters = listEditorPublisherAdapters(),
): string {
  return adapters.find(isEditorDryRunRunnable)?.id || ''
}

export function auditEditorPublisherAdapter(input: {
  adapter: EditorPublisherAdapterInfo
  publishPlan: EditorPublishPlan
}): EditorPublisherReadinessAudit {
  const hasPendingChapter = Boolean(input.publishPlan.pending[0])
  const manifestDryRun = input.adapter.runtime.editorDryRun
  const canDryRun = isEditorDryRunRunnable(input.adapter)
  const checks: EditorPublisherReadinessCheck[] = [
    {
      id: 'manifest-dry-run',
      label: 'Manifest dry-run',
      ready: manifestDryRun,
      detail: manifestDryRun ? 'declared' : 'not declared',
      optional: true,
    },
    {
      id: 'editor-runtime',
      label: 'Editor runtime',
      ready: canDryRun,
      detail: canDryRun ? 'preview runtime ready' : 'runtime not implemented',
    },
    {
      id: 'pending-chapter',
      label: 'Pending chapter',
      ready: hasPendingChapter,
      detail: hasPendingChapter
        ? `${input.publishPlan.pending.length} pending`
        : 'no pending chapter',
    },
    {
      id: 'config-path',
      label: 'Config path',
      ready: Boolean(input.adapter.configPath),
      detail: input.adapter.configPath || 'no .env path required',
      optional: true,
    },
  ]
  const blockingChecks = checks.filter((check) => !check.optional)
  const reasons = blockingChecks
    .filter((check) => !check.ready)
    .map((check) => check.detail)

  return {
    adapter: input.adapter,
    ready: reasons.length === 0,
    canDryRun,
    hasPendingChapter,
    reasons,
    checks,
  }
}

export function buildEditorPublishPlan(input: {
  project: NovelProject
  draftStore: ChapterDraftStore
  publishedChapterNumbers?: Set<number>
  startFrom?: number
}): EditorPublishPlan {
  const published = input.publishedChapterNumbers || new Set<number>()
  const startFrom = input.startFrom || 1
  const payloads = input.project.chapters.map((chapter) =>
    chapterToPayload(chapter, input.draftStore),
  )
  const candidates = payloads.filter((chapter) => chapter.number >= startFrom)
  const pending = candidates.filter((chapter) => !published.has(chapter.number))

  return {
    scanned: candidates.length,
    skipped: candidates.length - pending.length,
    pending,
  }
}

export async function runEditorPublisherDryRun(input: {
  adapterId?: string
  project: NovelProject
  draftStore: ChapterDraftStore
  publishedChapterNumbers?: Set<number>
  limit?: number
  adapters?: EditorPublisherAdapterInfo[]
}): Promise<PublishRunReport> {
  const adapterInfo = findEditorPublisherAdapter(
    input.adapterId || getDefaultEditorDryRunAdapterId(),
    input.adapters,
  )
  if (!isEditorDryRunRunnable(adapterInfo)) {
    throw new Error(`${adapterInfo.displayName} does not support editor dry-run.`)
  }

  const adapter = createEditorPublisherAdapter(adapterInfo.id)
  const plan = buildEditorPublishPlan(input)
  const toPublish = input.limit ? plan.pending.slice(0, input.limit) : plan.pending
  const report: PublishRunReport = {
    adapterId: adapter.id,
    scanned: plan.scanned,
    skipped: plan.skipped,
    attempted: 0,
    succeeded: 0,
    failed: 0,
    results: [],
  }

  for (const chapter of toPublish) {
    const result = await adapter.publishChapter(chapter)
    report.attempted += 1
    report.results.push({ chapter, result })

    if (result.status === 'success') {
      report.succeeded += 1
    } else {
      report.failed += 1
    }
  }

  return report
}

function createEditorPublisherAdapter(adapterId: string) {
  if (adapterId === 'dry-run') {
    return createDryRunAdapter()
  }

  throw new Error(`Publisher adapter runtime is not implemented: ${adapterId}`)
}

function isEditorDryRunRunnable(adapter: EditorPublisherAdapterInfo) {
  return adapter.runtime.editorDryRun && adapter.id === 'dry-run'
}

function chapterToPayload(
  chapter: ProjectChapter,
  draftStore: ChapterDraftStore,
): PublishChapterPayload {
  const content = draftStore.getDraft(chapter.id)?.content || chapter.content

  return {
    id: chapter.id,
    number: chapter.order,
    title: chapter.title,
    content,
    sourcePath: chapter.path,
    wordCount: countNonWhitespace(content),
  }
}

function countNonWhitespace(value: string): number {
  return value.replace(/\s/g, '').length
}
