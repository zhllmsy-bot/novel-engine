import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkNovelProject, formatProjectCheckReport } from './project-check.ts'

async function writeValidProject(root: string) {
  await mkdir(join(root, 'meta'), { recursive: true })
  await mkdir(join(root, 'manuscript'), { recursive: true })
  await mkdir(join(root, 'codex', 'characters'), { recursive: true })
  await writeFile(
    join(root, 'meta', 'project.json'),
    JSON.stringify({
      title: '本地项目',
      source_of_truth: 'markdown',
      chapters: [
        {
          id: 'chapter-001',
          title: '第一章',
          path: 'manuscript/chapter-001.md',
          order: 1,
        },
      ],
    }),
  )
  await writeFile(join(root, 'manuscript', 'chapter-001.md'), '# 第一章\n\n正文。')
  await writeFile(
    join(root, 'codex', 'characters', 'li.md'),
    `---
name: 李长老
keywords: [李长老]
---

人物设定。
`,
  )
}

describe('project check tool', () => {
  it('accepts a valid Markdown/YAML project folder', async () => {
    const root = await mkdtemp(join(tmpdir(), 'project-check-'))

    try {
      await writeValidProject(root)

      const report = await checkNovelProject(root)
      const output = formatProjectCheckReport(report)

      expect(report.ok).toBe(true)
      expect(report.title).toBe('本地项目')
      expect(report.stats).toMatchObject({
        chapters: 1,
        codexEntries: 1,
        codexEntriesWithoutKeywords: 0,
        codexEntriesWithDuplicateKeywords: 0,
        memoryEvalExpectations: 0,
        publisherAdapters: 2,
        failedPublisherAdapters: 0,
        providerAdapters: 2,
        failedProviderAdapters: 0,
      })
      expect(output).toContain('Project check: OK')
      expect(output).toContain('2 publisher adapters')
      expect(output).toContain('2 provider adapters')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('counts valid project-local Skill manifests in the project report', async () => {
    const root = await mkdtemp(join(tmpdir(), 'project-check-'))
    const skillsDir = join(root, 'skills')

    try {
      await writeValidProject(root)
      await mkdir(skillsDir)
      await writeFile(
        join(skillsDir, 'local.skill.yaml'),
        `
id: local.chapter_health
name: 章节体检
version: 0.1.0
category: analysis
description: 读取当前章节并输出体检报告。
risk_level: low
input:
  required: [nearby_text]
output:
  mode: report
  schema: report
safety:
  require_user_review: true
`,
      )

      const report = await checkNovelProject(root)
      const output = formatProjectCheckReport(report)

      expect(report.ok).toBe(true)
      expect(report.stats.skillFiles).toBe(1)
      expect(report.stats.failedSkillFiles).toBe(0)
      expect(output).toContain('1 skill files')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('includes project-local memory eval config failures in the project report', async () => {
    const root = await mkdtemp(join(tmpdir(), 'project-check-'))

    try {
      await writeValidProject(root)
      await writeFile(
        join(root, 'meta', 'memory-eval.json'),
        JSON.stringify({
          chapter_id: 'chapter-001',
          budget_chars: 200,
          minimum_gain: 1,
          expectations: [
            {
              id: 'bad-layer',
              description: 'Layer typo should fail the project check.',
              layer: 'L4 幻觉',
              contains: ['李长老'],
            },
          ],
        }),
      )

      const report = await checkNovelProject(root)
      const output = formatProjectCheckReport(report)

      expect(report.ok).toBe(false)
      expect(report.stats.memoryEvalExpectations).toBe(0)
      expect(report.errors.join('\n')).toContain(
        'meta/memory-eval.json expectations[0] layer must be one of: L0 事实, L1 剧情, L2 风格, L3 意图.',
      )
      expect(output).toContain('0 memory eval expectations')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('accepts project-local memory eval expectations in the project report', async () => {
    const root = await mkdtemp(join(tmpdir(), 'project-check-'))

    try {
      await writeValidProject(root)
      await writeFile(
        join(root, 'meta', 'memory-eval.json'),
        JSON.stringify({
          $schema: '../../schemas/memory-eval.schema.json',
          chapter_id: 'chapter-001',
          budget_chars: 200,
          minimum_gain: 0,
          expectations: [
            {
              id: 'l0-li-card',
              description: 'Project check should count valid recall expectations.',
              layer: 'L0 事实',
              contains: ['李长老'],
            },
          ],
        }),
      )

      const report = await checkNovelProject(root)
      const output = formatProjectCheckReport(report)

      expect(report.ok).toBe(true)
      expect(report.stats.memoryEvalExpectations).toBe(1)
      expect(output).toContain('1 memory eval expectations')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('fails when a codex card has no L3 recall keywords', async () => {
    const root = await mkdtemp(join(tmpdir(), 'project-check-'))

    try {
      await writeValidProject(root)
      await writeFile(
        join(root, 'codex', 'characters', 'li.md'),
        `---
name: 李长老
type: character
---

人物设定。
`,
      )

      const report = await checkNovelProject(root)

      expect(report.ok).toBe(false)
      expect(report.stats.codexEntriesWithoutKeywords).toBe(1)
      expect(report.errors.join('\n')).toContain(
        'codex entry has no keywords; L3 recall needs at least one explicit trigger',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('warns when codex recall keywords are duplicate or omit the entry name', async () => {
    const root = await mkdtemp(join(tmpdir(), 'project-check-'))

    try {
      await writeValidProject(root)
      await writeFile(
        join(root, 'codex', 'characters', 'li.md'),
        `---
name: 李长老
type: character
keywords: [戒律堂, 戒律堂]
---

人物设定。
`,
      )

      const report = await checkNovelProject(root)
      const output = formatProjectCheckReport(report)

      expect(report.ok).toBe(true)
      expect(report.stats.codexEntriesWithDuplicateKeywords).toBe(1)
      expect(report.warnings.join('\n')).toContain(
        'codex entry has duplicate keywords: 戒律堂',
      )
      expect(report.warnings.join('\n')).toContain(
        'codex keywords do not include the entry name "李长老"',
      )
      expect(output).toContain('WARN')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('fails when a manifest chapter path is missing', async () => {
    const root = await mkdtemp(join(tmpdir(), 'project-check-'))

    try {
      await writeValidProject(root)
      await writeFile(
        join(root, 'meta', 'project.json'),
        JSON.stringify({
          title: 'Broken',
          source_of_truth: 'markdown',
          chapters: [
            {
              id: 'chapter-404',
              title: 'Missing',
              path: 'manuscript/missing.md',
              order: 1,
            },
          ],
        }),
      )

      const report = await checkNovelProject(root)

      expect(report.ok).toBe(false)
      expect(report.errors.join('\n')).toContain(
        'manifest chapter file is missing',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('fails when project manifest is not a JSON object', async () => {
    const root = await mkdtemp(join(tmpdir(), 'project-check-'))

    try {
      await writeValidProject(root)
      await writeFile(join(root, 'meta', 'project.json'), JSON.stringify([]))

      const report = await checkNovelProject(root)

      expect(report.ok).toBe(false)
      expect(report.errors).toContain('meta/project.json must be a JSON object.')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('fails when manifest chapters is not an array', async () => {
    const root = await mkdtemp(join(tmpdir(), 'project-check-'))

    try {
      await writeValidProject(root)
      await writeFile(
        join(root, 'meta', 'project.json'),
        JSON.stringify({
          title: 'Broken',
          source_of_truth: 'markdown',
          chapters: {
            id: 'chapter-001',
            path: 'manuscript/chapter-001.md',
            order: 1,
          },
        }),
      )

      const report = await checkNovelProject(root)

      expect(report.ok).toBe(false)
      expect(report.errors).toContain(
        'meta/project.json chapters must be an array when present.',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('fails when project manifest static fields drift from the public schema', async () => {
    const root = await mkdtemp(join(tmpdir(), 'project-check-'))

    try {
      await writeValidProject(root)
      await writeFile(
        join(root, 'meta', 'project.json'),
        JSON.stringify({
          $schema: '',
          schema_version: 2,
          title: '',
          source_of_truth: 'sqlite',
          extra_field: true,
          chapters: [
            {
              id: 'Bad Chapter',
              title: '',
              path: '/absolute/chapter-001.md',
              order: 1,
              extra_chapter_field: true,
            },
          ],
        }),
      )

      const report = await checkNovelProject(root)
      const errors = report.errors.join('\n')

      expect(report.ok).toBe(false)
      expect(errors).toContain('meta/project.json unknown field: extra_field.')
      expect(errors).toContain(
        'meta/project.json $schema must be a non-empty string.',
      )
      expect(errors).toContain('meta/project.json schema_version must be 1.')
      expect(errors).toContain('meta/project.json title must be a non-empty string.')
      expect(errors).toContain('meta/project.json source_of_truth must be markdown.')
      expect(errors).toContain(
        'meta/project.json chapters[0] unknown field: extra_chapter_field.',
      )
      expect(errors).toContain(
        'meta/project.json chapter Bad Chapter id must match /^[a-z0-9][a-z0-9_.-]*$/.',
      )
      expect(errors).toContain(
        'meta/project.json chapter Bad Chapter title must be a non-empty string.',
      )
      expect(errors).toContain(
        'meta/project.json chapter Bad Chapter path must be a relative Markdown path.',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('fails when manifest chapter entries are not JSON objects', async () => {
    const root = await mkdtemp(join(tmpdir(), 'project-check-'))

    try {
      await writeValidProject(root)
      await writeFile(
        join(root, 'meta', 'project.json'),
        JSON.stringify({
          title: 'Broken',
          source_of_truth: 'markdown',
          chapters: ['manuscript/chapter-001.md'],
        }),
      )

      const report = await checkNovelProject(root)

      expect(report.ok).toBe(false)
      expect(report.errors).toContain(
        'meta/project.json chapters[0] must be a JSON object.',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('fails when manifest chapter orders are not positive integers', async () => {
    const root = await mkdtemp(join(tmpdir(), 'project-check-'))

    try {
      await writeValidProject(root)
      await writeFile(
        join(root, 'meta', 'project.json'),
        JSON.stringify({
          title: 'Broken',
          source_of_truth: 'markdown',
          chapters: [
            {
              id: 'chapter-001',
              title: '第一章',
              path: 'manuscript/chapter-001.md',
              order: 0,
            },
          ],
        }),
      )

      const report = await checkNovelProject(root)

      expect(report.ok).toBe(false)
      expect(report.errors.join('\n')).toContain(
        'meta/project.json chapter chapter-001 order must be a positive integer.',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('fails when manifest chapter orders are duplicated', async () => {
    const root = await mkdtemp(join(tmpdir(), 'project-check-'))

    try {
      await writeValidProject(root)
      await writeFile(join(root, 'manuscript', 'chapter-002.md'), '# 第二章\n\n正文。')
      await writeFile(
        join(root, 'meta', 'project.json'),
        JSON.stringify({
          title: 'Broken',
          source_of_truth: 'markdown',
          chapters: [
            {
              id: 'chapter-001',
              title: '第一章',
              path: 'manuscript/chapter-001.md',
              order: 1,
            },
            {
              id: 'chapter-002',
              title: '第二章',
              path: 'manuscript/chapter-002.md',
              order: 1,
            },
          ],
        }),
      )

      const report = await checkNovelProject(root)

      expect(report.ok).toBe(false)
      expect(report.errors.join('\n')).toContain(
        'meta/project.json chapter order 1 is duplicated by chapter-001 and chapter-002.',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('fails when manifest chapter ids are duplicated', async () => {
    const root = await mkdtemp(join(tmpdir(), 'project-check-'))

    try {
      await writeValidProject(root)
      await writeFile(join(root, 'manuscript', 'chapter-002.md'), '# 第二章\n\n正文。')
      await writeFile(
        join(root, 'meta', 'project.json'),
        JSON.stringify({
          title: 'Broken',
          source_of_truth: 'markdown',
          chapters: [
            {
              id: 'chapter-001',
              title: '第一章',
              path: 'manuscript/chapter-001.md',
              order: 1,
            },
            {
              id: 'chapter-001',
              title: '第二章',
              path: 'manuscript/chapter-002.md',
              order: 2,
            },
          ],
        }),
      )

      const report = await checkNovelProject(root)

      expect(report.ok).toBe(false)
      expect(report.errors.join('\n')).toContain(
        'meta/project.json chapter id chapter-001 is duplicated by chapter-001 and chapter-001.',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('fails when manifest chapter paths are duplicated', async () => {
    const root = await mkdtemp(join(tmpdir(), 'project-check-'))

    try {
      await writeValidProject(root)
      await writeFile(
        join(root, 'meta', 'project.json'),
        JSON.stringify({
          title: 'Broken',
          source_of_truth: 'markdown',
          chapters: [
            {
              id: 'chapter-001',
              title: '第一章',
              path: 'manuscript/chapter-001.md',
              order: 1,
            },
            {
              id: 'chapter-002',
              title: '第二章',
              path: 'manuscript/chapter-001.md',
              order: 2,
            },
          ],
        }),
      )

      const report = await checkNovelProject(root)

      expect(report.ok).toBe(false)
      expect(report.errors.join('\n')).toContain(
        'meta/project.json chapter path manuscript/chapter-001.md is duplicated by chapter-001 and chapter-002.',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('fails when a manifest chapter path is empty', async () => {
    const root = await mkdtemp(join(tmpdir(), 'project-check-'))

    try {
      await writeValidProject(root)
      await writeFile(
        join(root, 'meta', 'project.json'),
        JSON.stringify({
          title: 'Broken',
          source_of_truth: 'markdown',
          chapters: [
            {
              id: 'chapter-001',
              title: '第一章',
              order: 1,
            },
          ],
        }),
      )

      const report = await checkNovelProject(root)

      expect(report.ok).toBe(false)
      expect(report.errors.join('\n')).toContain(
        'meta/project.json chapter chapter-001 path must be a non-empty string.',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('fails when an implicit manifest chapter id duplicates an explicit id', async () => {
    const root = await mkdtemp(join(tmpdir(), 'project-check-'))

    try {
      await writeValidProject(root)
      await writeFile(join(root, 'manuscript', 'chapter-002.md'), '# 第二章\n\n正文。')
      await writeFile(
        join(root, 'meta', 'project.json'),
        JSON.stringify({
          title: 'Broken',
          source_of_truth: 'markdown',
          chapters: [
            {
              id: 'chapter-002',
              title: '第一章',
              path: 'manuscript/chapter-001.md',
              order: 1,
            },
            {
              title: '第二章',
              path: 'manuscript/chapter-002.md',
              order: 2,
            },
          ],
        }),
      )

      const report = await checkNovelProject(root)

      expect(report.ok).toBe(false)
      expect(report.errors.join('\n')).toContain(
        'meta/project.json chapter id chapter-002 is duplicated by chapter-002 and 第二章.',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('includes project-local Skill failures in the project report', async () => {
    const root = await mkdtemp(join(tmpdir(), 'project-check-'))
    const skillsDir = join(root, 'skills')

    try {
      await writeValidProject(root)
      await mkdir(skillsDir)
      await writeFile(
        join(skillsDir, 'bad.skill.yaml'),
        `
id: bad.skill
name: Bad Skill
version: 0.1.0
category: analysis
description: Bad input.
risk_level: low
input:
  required: [chapter_summry]
output:
  mode: report
  schema: report
`,
      )

      const report = await checkNovelProject(root)

      expect(report.ok).toBe(false)
      expect(report.stats.failedSkillFiles).toBe(1)
      expect(report.errors.join('\n')).toContain('未知输入: chapter_summry')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('includes project-local publisher adapter failures in the project report', async () => {
    const root = await mkdtemp(join(tmpdir(), 'project-check-'))
    const adapterDir = join(root, 'publisher', 'adapters', 'broken')

    try {
      await writeValidProject(root)
      await mkdir(adapterDir, { recursive: true })
      await writeFile(
        join(adapterDir, 'publisher.adapter.json'),
        JSON.stringify({
          $schema: '../../../schemas/publisher-adapter.schema.json',
          id: 'Bad Adapter',
          display_name: 'Broken',
          description: 'Bad adapter metadata.',
          status: 'live',
          runtime: {
            editor_dry_run: false,
          },
          capabilities: [],
        }),
      )

      const report = await checkNovelProject(root)

      expect(report.ok).toBe(false)
      expect(report.stats.failedPublisherAdapters).toBe(1)
      expect(report.errors.join('\n')).toContain('status 必须是')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('allows project-local publisher adapters to override bundled adapter ids', async () => {
    const root = await mkdtemp(join(tmpdir(), 'project-check-'))
    const adapterDir = join(root, 'publisher', 'adapters', 'fanqie')

    try {
      await writeValidProject(root)
      await mkdir(adapterDir, { recursive: true })
      await writeFile(
        join(adapterDir, 'publisher.adapter.json'),
        JSON.stringify({
          $schema: '../../../schemas/publisher-adapter.schema.json',
          id: 'fanqie',
          display_name: 'Fanqie Local Override',
          description: 'Project-local publisher metadata.',
          status: 'configured',
          config_path: 'publisher/adapters/fanqie/.env',
          runtime: {
            editor_dry_run: false,
          },
          capabilities: ['项目本地覆盖'],
        }),
      )

      const report = await checkNovelProject(root)

      expect(report.ok).toBe(true)
      expect(report.stats.publisherAdapters).toBe(3)
      expect(report.stats.failedPublisherAdapters).toBe(0)
      expect(report.errors.join('\n')).not.toContain(
        'duplicate publisher adapter id fanqie',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('includes project-local provider adapter failures in the project report', async () => {
    const root = await mkdtemp(join(tmpdir(), 'project-check-'))
    const adapterDir = join(root, 'providers', 'broken')

    try {
      await writeValidProject(root)
      await mkdir(adapterDir, { recursive: true })
      await writeFile(
        join(adapterDir, 'provider.adapter.json'),
        JSON.stringify({
          $schema: '../../schemas/provider-adapter.schema.json',
          id: 'Bad Provider',
          label: 'Broken',
          kind: 'unknown',
          description: 'Bad provider metadata.',
          status: 'live',
          config_fields: ['token'],
          capabilities: [],
        }),
      )

      const report = await checkNovelProject(root)

      expect(report.ok).toBe(false)
      expect(report.stats.failedProviderAdapters).toBe(1)
      expect(report.errors.join('\n')).toContain('status 必须是')
      expect(report.errors.join('\n')).toContain('未知 config_fields: token')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('allows project-local provider adapters to override bundled adapter ids', async () => {
    const root = await mkdtemp(join(tmpdir(), 'project-check-'))
    const adapterDir = join(root, 'providers', 'openai')

    try {
      await writeValidProject(root)
      await mkdir(adapterDir, { recursive: true })
      await writeFile(
        join(adapterDir, 'provider.adapter.json'),
        JSON.stringify({
          $schema: '../../schemas/provider-adapter.schema.json',
          id: 'openai',
          label: 'Project Gateway',
          kind: 'openai-compatible',
          description: 'Project-local OpenAI-compatible gateway metadata.',
          status: 'configured',
          config_fields: ['baseUrl', 'model', 'apiKey'],
          capabilities: ['项目本地覆盖'],
        }),
      )

      const report = await checkNovelProject(root)

      expect(report.ok).toBe(true)
      expect(report.stats.providerAdapters).toBe(3)
      expect(report.stats.failedProviderAdapters).toBe(0)
      expect(report.errors.join('\n')).not.toContain(
        'duplicate provider adapter id openai',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
