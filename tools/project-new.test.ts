import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { evaluateNarrativeMemory } from './memory-eval.ts'
import { checkNovelProject } from './project-check.ts'
import {
  buildInitialChapter,
  buildMemoryEvalConfig,
  buildProjectManifest,
  buildStarterCodexCard,
  createNovelProject,
  parseProjectNewArgs,
} from './project-new.ts'

describe('project new tool', () => {
  it('builds a Markdown-first manifest linked to a project-local schema', () => {
    const source = buildProjectManifest({
      title: '本地新书',
      outputPath: '/novels/MyNovel',
      force: false,
      help: false,
    })
    const manifest = JSON.parse(source) as {
      $schema: string
      schema_version: number
      title: string
      source_of_truth: string
      chapters: Array<{ id: string; path: string; order: number }>
    }

    expect(manifest).toMatchObject({
      $schema: '../.novel/schemas/project.schema.json',
      schema_version: 1,
      title: '本地新书',
      source_of_truth: 'markdown',
    })
    expect(manifest.chapters).toEqual([
      {
        id: 'chapter-001',
        title: '第001章 开篇',
        path: 'manuscript/volume-001/chapter-001.md',
        order: 1,
      },
    ])
  })

  it('builds starter Markdown assets with recall keywords', () => {
    expect(buildInitialChapter()).toContain('# 第001章 开篇')
    expect(buildInitialChapter()).toContain('主角站在雨中的山门前')
    expect(buildStarterCodexCard()).toContain('keywords: [主角]')
  })

  it('builds a starter memory eval config for the generated project', () => {
    const source = buildMemoryEvalConfig('/novels/MyNovel')
    const config = JSON.parse(source) as {
      $schema: string
      chapter_id: string
      minimum_gain: number
      expectations: Array<{
        id: string
        layer: string
        contains: string[]
        source_contains?: string[]
        source_families?: string[]
      }>
    }

    expect(config).toMatchObject({
      $schema: '../.novel/schemas/memory-eval.schema.json',
      chapter_id: 'chapter-001',
      minimum_gain: 0,
    })
    expect(config.expectations.map((expectation) => expectation.layer)).toEqual([
      'L2 风格',
      'L0 事实',
      'L3 意图',
    ])
    expect(config.expectations[1].contains).toContain('当前状态')
    expect(config.expectations[1].source_contains).toEqual([
      'codex/characters/',
    ])
    expect(config.expectations[1].source_families).toEqual(['codex'])
    expect(config.expectations[2].source_contains).toEqual(['meta/project.json'])
    expect(config.expectations[2].source_families).toEqual(['project'])
  })

  it('creates a project folder that passes the project health check', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'project-new-'))
    const root = join(parent, 'MyNovel')

    try {
      const created = await createNovelProject({
        title: '本地新书',
        outputPath: root,
        force: false,
        help: false,
      })
      const manifestSource = await readFile(
        join(root, 'meta', 'project.json'),
        'utf8',
      )
      const schemaSource = await readFile(
        join(root, '.novel', 'schemas', 'project.schema.json'),
        'utf8',
      )
      const memoryEvalSchemaSource = await readFile(
        join(root, '.novel', 'schemas', 'memory-eval.schema.json'),
        'utf8',
      )
      const memoryEvalSource = await readFile(
        join(root, 'meta', 'memory-eval.json'),
        'utf8',
      )
      const chapterSource = await readFile(
        join(root, 'manuscript', 'volume-001', 'chapter-001.md'),
        'utf8',
      )
      const codexSource = await readFile(
        join(root, 'codex', 'characters', 'protagonist.md'),
        'utf8',
      )
      const report = await checkNovelProject(root)
      const memoryReport = await evaluateNarrativeMemory({ rootPath: root })

      expect(created).toMatchObject({
        path: root,
        title: '本地新书',
        manifestPath: join(root, 'meta', 'project.json'),
      })
      expect(manifestSource).toContain(
        '"$schema": "../.novel/schemas/project.schema.json"',
      )
      expect(memoryEvalSource).toContain(
        '"$schema": "../.novel/schemas/memory-eval.schema.json"',
      )
      expect(schemaSource).toContain('"title": "Novel Engine Project Manifest"')
      expect(memoryEvalSchemaSource).toContain(
        '"title": "Novel Engine Memory Eval Config"',
      )
      expect(chapterSource).toContain('在这里开始第一章正文。')
      expect(codexSource).toContain('keywords: [主角]')
      expect(report.ok).toBe(true)
      expect(report.stats.chapters).toBe(1)
      expect(report.stats.codexEntries).toBe(1)
      expect(report.stats.codexEntriesWithoutKeywords).toBe(0)
      expect(report.stats.memoryEvalExpectations).toBe(3)
      expect(memoryReport.ok).toBe(true)
      expect(memoryReport.stats.passed).toBe(3)
      expect(memoryReport.stats.baselinePassed).toBe(1)
      expect(
        memoryReport.cases.find(
          (result) => result.id === 'starter-l0-protagonist-card',
        ),
      ).toMatchObject({
        missingSources: [],
        missingSourceFamilies: [],
        sourceFamilies: ['codex'],
        matchedSources: ['codex/characters/protagonist.md'],
      })
      expect(
        memoryReport.cases.find(
          (result) => result.id === 'starter-l3-recall-audit',
        ),
      ).toMatchObject({
        missingSources: [],
        missingSourceFamilies: [],
        sourceFamilies: ['project'],
        matchedSources: ['meta/project.json'],
      })
    } finally {
      await rm(parent, { recursive: true, force: true })
    }
  })

  it('parses CLI options and rejects missing required values', () => {
    const options = parseProjectNewArgs([
      '--title',
      '本地新书',
      '--out',
      'tmp/MyNovel',
      '--force',
    ])

    expect(options).toMatchObject({
      title: '本地新书',
      outputPath: join(process.cwd(), 'tmp', 'MyNovel'),
      force: true,
      help: false,
    })
    expect(() => parseProjectNewArgs(['--out', 'tmp/MyNovel'])).toThrow(
      '--title is required.',
    )
    expect(() => parseProjectNewArgs(['--title', '本地新书'])).toThrow(
      '--out is required.',
    )
    expect(() => parseProjectNewArgs(['--title'])).toThrow(
      '--title requires a value.',
    )
  })
})
