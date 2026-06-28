import { describe, expect, it } from 'vitest'
import { createChapterDraftStore } from '../project/chapterDraftStore'
import type { NovelProject } from '../project/projectTypes'
import {
  auditEditorPublisherAdapter,
  buildEditorPublisherAdapterCatalog,
  buildEditorPublishPlan,
  getDefaultEditorDryRunAdapterId,
  listEditorPublisherAdapters,
  loadProjectPublisherAdapterCatalog,
  runEditorPublisherDryRun,
} from './editorPublisher'

const project: NovelProject = {
  title: 'Demo',
  sourceOfTruth: 'markdown',
  chapters: [
    {
      id: 'chapter-1',
      title: '山门雨',
      status: '编辑中',
      path: 'manuscript/chapter-001.md',
      order: 1,
      content: '旧稿',
      wordCount: 2,
    },
    {
      id: 'chapter-2',
      title: '玄铁剑',
      status: '已摘要',
      path: 'manuscript/chapter-002.md',
      order: 2,
      content: '第二章',
      wordCount: 3,
    },
  ],
  codexEntries: [],
}

describe('editor publisher bridge', () => {
  it('builds pending publish payloads from editor drafts', () => {
    const draftStore = createChapterDraftStore(project.chapters)
    draftStore.updateDraft('chapter-1', '新稿内容')

    const plan = buildEditorPublishPlan({
      project,
      draftStore,
      publishedChapterNumbers: new Set([2]),
    })

    expect(plan.scanned).toBe(2)
    expect(plan.skipped).toBe(1)
    expect(plan.pending).toHaveLength(1)
    expect(plan.pending[0]).toMatchObject({
      id: 'chapter-1',
      number: 1,
      title: '山门雨',
      content: '新稿内容',
      wordCount: 4,
    })
  })

  it('runs dry-run publishing with the shared publisher adapter contract', async () => {
    const draftStore = createChapterDraftStore(project.chapters)
    const report = await runEditorPublisherDryRun({
      adapterId: 'dry-run',
      project,
      draftStore,
      limit: 1,
    })

    expect(report.adapterId).toBe('dry-run')
    expect(report.attempted).toBe(1)
    expect(report.succeeded).toBe(1)
    expect(report.results[0]?.result.remoteId).toBe('dry-run:1')
  })

  it('selects the first adapter that supports editor dry-run', () => {
    const adapters = listEditorPublisherAdapters()

    expect(getDefaultEditorDryRunAdapterId(adapters)).toBe('dry-run')
  })

  it('rejects adapters that do not support editor dry-run', async () => {
    const draftStore = createChapterDraftStore(project.chapters)

    await expect(
      runEditorPublisherDryRun({
        adapterId: 'fanqie',
        project,
        draftStore,
        limit: 1,
      }),
    ).rejects.toThrow('Fanqie Publisher does not support editor dry-run.')
  })

  it('describes editor publisher adapters for the plugin panel', () => {
    const adapters = listEditorPublisherAdapters()

    expect(adapters.map((adapter) => adapter.id)).toEqual(['dry-run', 'fanqie'])
    expect(adapters[0]).toMatchObject({
      status: 'available',
      capabilities: expect.arrayContaining(['验证发布契约']),
      runtime: {
        editorDryRun: true,
      },
    })
    expect(adapters[1]).toMatchObject({
      status: 'planned',
      configPath: 'publisher/adapters/fanqie/.env.example',
      runtime: {
        editorDryRun: false,
      },
    })
  })

  it('audits a runnable editor publisher adapter', () => {
    const adapters = listEditorPublisherAdapters()
    const draftStore = createChapterDraftStore(project.chapters)
    const plan = buildEditorPublishPlan({ project, draftStore })
    const audit = auditEditorPublisherAdapter({
      adapter: adapters[0],
      publishPlan: plan,
    })

    expect(audit.ready).toBe(true)
    expect(audit.canDryRun).toBe(true)
    expect(audit.hasPendingChapter).toBe(true)
    expect(audit.reasons).toEqual([])
    expect(audit.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'manifest-dry-run',
          optional: true,
          ready: true,
        }),
        expect.objectContaining({
          id: 'editor-runtime',
          ready: true,
        }),
        expect.objectContaining({
          id: 'pending-chapter',
          ready: true,
        }),
        expect.objectContaining({
          id: 'config-path',
          optional: true,
          ready: false,
        }),
      ]),
    )
  })

  it('blocks planned publisher adapters before editor dry-run exists', () => {
    const adapters = listEditorPublisherAdapters()
    const draftStore = createChapterDraftStore(project.chapters)
    const plan = buildEditorPublishPlan({ project, draftStore })
    const audit = auditEditorPublisherAdapter({
      adapter: adapters[1],
      publishPlan: plan,
    })

    expect(audit.ready).toBe(false)
    expect(audit.reasons).toEqual(['runtime not implemented'])
    expect(audit.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'manifest-dry-run',
          optional: true,
          ready: false,
        }),
        expect.objectContaining({
          id: 'editor-runtime',
          ready: false,
        }),
        expect.objectContaining({
          id: 'pending-chapter',
          ready: true,
        }),
        expect.objectContaining({
          id: 'config-path',
          optional: true,
          ready: true,
        }),
      ]),
    )
  })

  it('blocks publisher preview when there are no pending chapters', () => {
    const adapters = listEditorPublisherAdapters()
    const draftStore = createChapterDraftStore(project.chapters)
    const plan = buildEditorPublishPlan({
      project,
      draftStore,
      publishedChapterNumbers: new Set([1, 2]),
    })
    const audit = auditEditorPublisherAdapter({
      adapter: adapters[0],
      publishPlan: plan,
    })

    expect(audit.ready).toBe(false)
    expect(audit.reasons).toEqual(['no pending chapter'])
    expect(audit.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'editor-runtime',
          ready: true,
        }),
        expect.objectContaining({
          id: 'pending-chapter',
          ready: false,
        }),
      ]),
    )
  })

  it('loads project-local publisher manifests after bundled adapters', async () => {
    const catalog = await loadProjectPublisherAdapterCatalog({
      projectRoot: '/novels/demo',
      isTauri: () => true,
      scanAdapters: async () => [
        {
          file_path: 'publisher/adapters/community/publisher.adapter.json',
          content: JSON.stringify({
            $schema: '../../../schemas/publisher-adapter.schema.json',
            id: 'community',
            display_name: 'Community Publisher',
            description: 'Project local adapter manifest.',
            status: 'planned',
            config_path: 'publisher/adapters/community/.env.example',
            runtime: {
              editor_dry_run: false,
            },
            capabilities: ['项目本地 manifest'],
          }),
        },
      ],
    })

    expect(catalog.errors).toEqual([])
    expect(catalog.adapters.find((adapter) => adapter.id === 'community')).toMatchObject({
      source: 'project',
      path: 'publisher/adapters/community/publisher.adapter.json',
      configPath: 'publisher/adapters/community/.env.example',
    })
  })

  it('lets project-local publisher manifests override bundled metadata without enabling runtime', async () => {
    const catalog = await loadProjectPublisherAdapterCatalog({
      projectRoot: '/novels/demo',
      isTauri: () => true,
      scanAdapters: async () => [
        {
          file_path: 'publisher/adapters/fanqie/publisher.adapter.json',
          content: JSON.stringify({
            $schema: '../../../schemas/publisher-adapter.schema.json',
            id: 'fanqie',
            display_name: 'Fanqie Local Override',
            description: 'Project local Fanqie metadata.',
            status: 'configured',
            runtime: {
              editor_dry_run: true,
            },
            capabilities: ['本地覆盖 metadata'],
          }),
        },
      ],
    })
    const fanqie = catalog.adapters.find((adapter) => adapter.id === 'fanqie')
    const draftStore = createChapterDraftStore(project.chapters)
    const plan = buildEditorPublishPlan({ project, draftStore })
    const audit = auditEditorPublisherAdapter({
      adapter: fanqie!,
      publishPlan: plan,
    })

    expect(fanqie).toMatchObject({
      displayName: 'Fanqie Local Override',
      source: 'project',
      runtime: {
        editorDryRun: true,
      },
    })
    expect(audit.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'manifest-dry-run',
          ready: true,
        }),
        expect.objectContaining({
          id: 'editor-runtime',
          ready: false,
        }),
      ]),
    )
    expect(audit.ready).toBe(false)
    await expect(
      runEditorPublisherDryRun({
        adapterId: 'fanqie',
        project,
        draftStore,
        adapters: catalog.adapters,
      }),
    ).rejects.toThrow('Fanqie Local Override does not support editor dry-run.')
  })

  it('collects invalid project-local publisher manifest errors', async () => {
    const catalog = await loadProjectPublisherAdapterCatalog({
      projectRoot: '/novels/demo',
      isTauri: () => true,
      scanAdapters: async () => [
        {
          file_path: 'publisher/adapters/broken/publisher.adapter.json',
          content: JSON.stringify({
            $schema: '../../../schemas/publisher-adapter.schema.json',
            id: 'Broken Adapter',
            display_name: '',
            description: 'Broken.',
            status: 'planned',
            runtime: {
              editor_dry_run: false,
            },
            capabilities: [],
          }),
        },
      ],
    })

    expect(catalog.adapters.map((adapter) => adapter.id)).toEqual([
      'dry-run',
      'fanqie',
    ])
    expect(catalog.errors[0]).toContain(
      'publisher/adapters/broken/publisher.adapter.json',
    )
    expect(catalog.errors[0]).toContain('display_name 必须是非空字符串')
  })

  it('falls back to bundled publisher adapters when project scanning fails', async () => {
    const catalog = await loadProjectPublisherAdapterCatalog({
      projectRoot: '/novels/demo',
      isTauri: () => true,
      scanAdapters: async () => {
        throw new Error('permission denied')
      },
    })

    expect(catalog.adapters.map((adapter) => adapter.id)).toEqual([
      'dry-run',
      'fanqie',
    ])
    expect(catalog.errors).toEqual([
      'publisher/adapters/: permission denied',
    ])
  })

  it('reports duplicate publisher ids declared within the same source kind', () => {
    const publisherSource = (displayName: string) =>
      JSON.stringify({
        $schema: '../../../schemas/publisher-adapter.schema.json',
        id: 'community',
        display_name: displayName,
        description: 'Duplicate publisher id.',
        status: 'planned',
        runtime: {
          editor_dry_run: false,
        },
        capabilities: ['测试'],
      })
    const catalog = buildEditorPublisherAdapterCatalog([
      {
        path: 'publisher/adapters/first/publisher.adapter.json',
        sourceKind: 'project',
        source: publisherSource('First Publisher'),
      },
      {
        path: 'publisher/adapters/second/publisher.adapter.json',
        sourceKind: 'project',
        source: publisherSource('Second Publisher'),
      },
    ])

    expect(catalog.adapters).toHaveLength(1)
    expect(catalog.adapters[0].displayName).toBe('Second Publisher')
    expect(catalog.errors[0]).toContain(
      'duplicate publisher adapter id community',
    )
    expect(catalog.errors[0]).toContain(
      'publisher/adapters/first/publisher.adapter.json',
    )
  })

  it('builds publisher catalogs from explicit manifest sources', () => {
    const catalog = buildEditorPublisherAdapterCatalog([
      {
        path: 'publisher/adapters/community/publisher.adapter.json',
        sourceKind: 'project',
        source: JSON.stringify({
          $schema: '../../../schemas/publisher-adapter.schema.json',
          id: 'community',
          display_name: 'Community Publisher',
          description: 'Project adapter.',
          status: 'planned',
          runtime: {
            editor_dry_run: false,
          },
          capabilities: ['测试'],
        }),
      },
    ])

    expect(catalog).toMatchObject({
      errors: [],
      adapters: [
        {
          id: 'community',
          source: 'project',
          path: 'publisher/adapters/community/publisher.adapter.json',
        },
      ],
    })
  })
})
