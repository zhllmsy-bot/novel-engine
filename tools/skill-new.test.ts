import { mkdir, mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseSkillManifest } from '../src/skills/skillManifest.ts'
import {
  buildSkillTemplate,
  createSkillManifest,
  parseSkillNewArgs,
} from './skill-new.ts'

describe('skill new tool', () => {
  it('builds a rewrite Skill template that validates with the shared parser', () => {
    const source = buildSkillTemplate({
      id: 'community.dialogue_polish',
      name: '对白润色',
      outputPath: 'unused.skill.yaml',
      mode: 'rewrite_patch',
      risk: 'medium',
      category: 'rewrite',
      force: false,
      help: false,
    })
    const result = parseSkillManifest(source)

    expect(result.ok).toBe(true)
    if (!result.ok) {
      throw new Error(result.errors.join('\n'))
    }
    expect(result.manifest).toMatchObject({
      id: 'community.dialogue_polish',
      name: '对白润色',
      outputMode: 'rewrite_patch',
      outputSchema: 'diff_patch',
      requiresReview: true,
    })
    expect(result.manifest.retrieval?.sourceFamilies).toEqual([
      'manuscript',
      'codex',
      'chapter_summary',
      'recall',
    ])
    expect(source).toContain('require_snapshot_before_apply: true')
  })

  it('builds mode-aware source families for memory, report, and export Skills', () => {
    const plotThread = parseSkillManifest(
      buildSkillTemplate({
        id: 'community.plot_memory',
        name: '伏笔入库',
        outputPath: 'unused.skill.yaml',
        mode: 'memory_update_proposal',
        schema: 'plot_thread_proposal',
        risk: 'high',
        category: 'memory',
        force: false,
        help: false,
      }),
    )
    const characterState = parseSkillManifest(
      buildSkillTemplate({
        id: 'community.character_state',
        name: '人物状态入库',
        outputPath: 'unused.skill.yaml',
        mode: 'memory_update_proposal',
        schema: 'character_state_proposal',
        risk: 'high',
        category: 'memory',
        force: false,
        help: false,
      }),
    )
    const report = parseSkillManifest(
      buildSkillTemplate({
        id: 'community.report',
        name: '章节体检',
        outputPath: 'unused.skill.yaml',
        mode: 'report',
        risk: 'low',
        category: 'analysis',
        force: false,
        help: false,
      }),
    )
    const chapterSummary = parseSkillManifest(
      buildSkillTemplate({
        id: 'community.chapter_summary',
        name: '章节摘要',
        outputPath: 'unused.skill.yaml',
        mode: 'chapter_summary',
        risk: 'low',
        category: 'memory',
        force: false,
        help: false,
      }),
    )
    const exportArtifact = parseSkillManifest(
      buildSkillTemplate({
        id: 'community.export',
        name: '导出工件',
        outputPath: 'unused.skill.yaml',
        mode: 'export_artifact',
        risk: 'low',
        category: 'export',
        force: false,
        help: false,
      }),
    )

    expect(plotThread.ok).toBe(true)
    expect(characterState.ok).toBe(true)
    expect(report.ok).toBe(true)
    expect(chapterSummary.ok).toBe(true)
    expect(exportArtifact.ok).toBe(true)

    if (plotThread.ok) {
      expect(plotThread.manifest.retrieval?.sourceFamilies).toEqual([
        'manuscript',
        'codex',
        'chapter_summary',
        'plot_thread',
        'recall',
      ])
    }
    if (characterState.ok) {
      expect(characterState.manifest.retrieval?.sourceFamilies).toEqual([
        'manuscript',
        'codex',
        'character_state_log',
        'chapter_summary',
        'recall',
      ])
    }
    if (report.ok) {
      expect(report.manifest.retrieval?.sourceFamilies).toEqual([
        'manuscript',
        'codex',
        'project',
        'chapter_summary',
        'volume_summary',
        'plot_thread',
        'character_state_log',
        'recall',
      ])
    }
    if (chapterSummary.ok) {
      expect(chapterSummary.manifest).toMatchObject({
        outputMode: 'chapter_summary',
        outputSchema: 'chapter_summary',
      })
      expect(chapterSummary.manifest.retrieval?.sourceFamilies).toEqual([
        'manuscript',
        'codex',
        'chapter_summary',
        'plot_thread',
        'recall',
      ])
    }
    if (exportArtifact.ok) {
      expect(exportArtifact.manifest.retrieval?.sourceFamilies).toEqual([
        'manuscript',
        'project',
        'chapter_summary',
        'volume_summary',
      ])
    }
  })

  it('creates a memory proposal Skill file at the requested path', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skill-new-'))
    const outputPath = join(root, 'skills', 'memory.skill.yaml')
    await mkdir(join(root, 'skills'), { recursive: true })

    try {
      const created = await createSkillManifest({
        id: 'community.memory_probe',
        name: '记忆提案',
        outputPath,
        mode: 'memory_update_proposal',
        schema: 'plot_thread_proposal',
        risk: 'high',
        category: 'memory',
        force: false,
        help: false,
      })
      const source = await readFile(outputPath, 'utf8')
      const parsed = parseSkillManifest(source)

      expect(created).toEqual({
        path: outputPath,
        skillId: 'community.memory_probe',
      })
      expect(source).toContain('schema: plot_thread_proposal')
      expect(source).toContain('    - plot_thread')
      expect(source).not.toContain('require_snapshot_before_apply')
      expect(parsed.ok).toBe(true)
      if (parsed.ok) {
        expect(parsed.manifest.outputSchema).toBe('plot_thread_proposal')
        expect(parsed.manifest.retrieval?.sourceFamilies).toContain('plot_thread')
      }
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('creates a project-local Skill under the project skills directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skill-new-project-'))

    try {
      const options = parseSkillNewArgs([
        '--project',
        root,
        '--id',
        'demo.local_review',
        '--name',
        '本地体检',
        '--mode',
        'report',
        '--risk',
        'low',
        '--category',
        'memory',
      ])
      const created = await createSkillManifest(options)
      const source = await readFile(created.path, 'utf8')
      const schema = await readFile(
        join(root, '.novel', 'schemas', 'skill.schema.json'),
        'utf8',
      )
      const parsed = parseSkillManifest(source)

      expect(options.outputPath).toBe(
        join(root, 'skills', 'demo.local_review.skill.yaml'),
      )
      expect(options.projectRoot).toBe(root)
      expect(created.path).toBe(options.outputPath)
      expect(source).toContain(
        '# yaml-language-server: $schema=../.novel/schemas/skill.schema.json',
      )
      expect(source).toContain('schema: report')
      expect(schema).toContain('"title": "Novel Engine Skill Manifest"')
      expect(parsed.ok).toBe(true)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('parses CLI options and rejects invalid enum values', () => {
    const options = parseSkillNewArgs([
      '--id',
      'community.report',
      '--name',
      '章节体检',
      '--mode',
      'report',
      '--schema',
      'report',
      '--risk',
      'low',
      '--category',
      'analysis',
      '--out',
      'skills/report.skill.yaml',
    ])

    expect(options).toMatchObject({
      id: 'community.report',
      name: '章节体检',
      mode: 'report',
      schema: 'report',
      risk: 'low',
      category: 'analysis',
      force: false,
      help: false,
    })
    expect(() =>
      parseSkillNewArgs([
        '--id',
        'community.bad',
        '--name',
        'Bad',
        '--mode',
        'unsafe',
      ]),
    ).toThrow('--mode must be one of')
    expect(() =>
      parseSkillNewArgs([
        '--id',
        'community.bad',
        '--name',
        'Bad',
        '--schema',
        'unsafe',
      ]),
    ).toThrow('--schema must be one of')
    expect(() =>
      parseSkillNewArgs([
        '--id',
        'community.bad',
        '--name',
        'Bad',
        '--risk',
        'critical',
      ]),
    ).toThrow('--risk must be one of')
  })

  it('rejects generated Skill manifests when --schema does not match --mode', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skill-new-schema-'))

    try {
      await expect(
        createSkillManifest({
          id: 'community.bad_schema',
          name: '错误 Schema',
          outputPath: join(root, 'bad.skill.yaml'),
          mode: 'report',
          schema: 'plot_thread_proposal',
          risk: 'low',
          category: 'memory',
          force: false,
          help: false,
        }),
      ).rejects.toThrow('output.schema 与 output.mode 不匹配')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('resolves --out relative to --project when both are provided', () => {
    const root = join(tmpdir(), 'skill-new-project-root')
    const options = parseSkillNewArgs([
      '--project',
      root,
      '--id',
      'demo.custom',
      '--name',
      '自定义 Skill',
      '--out',
      'skills/custom.skill.yaml',
    ])

    expect(options.outputPath).toBe(join(root, 'skills', 'custom.skill.yaml'))
    expect(options.projectRoot).toBe(root)
  })
})
