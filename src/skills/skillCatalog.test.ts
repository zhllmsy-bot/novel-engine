import { describe, expect, it } from 'vitest'
import type { SkillCatalogEntry } from './skillCatalog'
import {
  buildSkillCatalog,
  describeSkillCatalogSource,
  filterSkillCatalogEntriesBySource,
  findChapterSummarySkill,
  findRewriteSkill,
  formatSkillCatalogSource,
  loadProjectSkillCatalog,
  loadSkillCatalog,
  summarizeSkillCatalogSources,
} from './skillCatalog'

const builtinEntry: SkillCatalogEntry = {
  source: 'builtin',
  manifest: {
    id: 'xuanhuan.dialogue_polish',
    name: '内置润色',
    version: '0.1.0',
    category: 'rewrite',
    description: '内置版本。',
    riskLevel: 'medium',
    outputMode: 'rewrite_patch',
    outputSchema: 'diff_patch',
    requiresReview: true,
  },
}

describe('skill catalog', () => {
  it('loads example YAML skills and exposes a rewrite skill', () => {
    const catalog = loadSkillCatalog()
    const rewriteSkill = findRewriteSkill(catalog)
    const summarySkill = findChapterSummarySkill(catalog)

    expect(catalog.errors).toEqual([])
    expect(rewriteSkill?.name).toBe('玄幻对白润色')
    expect(summarySkill).toMatchObject({
      id: 'core.chapter_summary_generate',
      outputMode: 'chapter_summary',
      outputSchema: 'chapter_summary',
    })
    expect(
      catalog.skills.find(
        (entry) => entry.manifest.id === 'xuanhuan.foreshadowing_thread',
      ),
    ).toMatchObject({
      source: 'bundled_yaml',
      manifest: {
        outputMode: 'memory_update_proposal',
        outputSchema: 'plot_thread_proposal',
      },
    })
  })

  it('lets YAML skills override builtin skills with the same id', () => {
    const catalog = buildSkillCatalog([builtinEntry], [
      {
        path: 'local.skill.yaml',
        source: `
id: xuanhuan.dialogue_polish
name: 社区润色
version: 0.2.0
category: rewrite
description: 社区版本。
risk_level: medium
output:
  mode: rewrite_patch
  schema: diff_patch
safety:
  require_snapshot_before_apply: true
  require_user_review: true
`,
      },
    ])

    expect(catalog.skills).toHaveLength(1)
    expect(catalog.skills[0]).toMatchObject({
      source: 'bundled_yaml',
      path: 'local.skill.yaml',
      manifest: {
        name: '社区润色',
        version: '0.2.0',
      },
    })
  })

  it('reports duplicate Skill ids declared within the same YAML source scope', () => {
    const skillSource = (name: string) => `
id: community.same_id
name: ${name}
version: 0.1.0
category: report
description: Duplicate id.
risk_level: low
output:
  mode: report
  schema: report
`
    const catalog = buildSkillCatalog([], [
      {
        path: 'skills/first.skill.yaml',
        source: skillSource('First Skill'),
        scope: 'project',
      },
      {
        path: 'skills/second.skill.yaml',
        source: skillSource('Second Skill'),
        scope: 'project',
      },
    ])

    expect(catalog.skills).toHaveLength(1)
    expect(catalog.skills[0].manifest.name).toBe('Second Skill')
    expect(catalog.errors[0]).toContain('duplicate Skill id community.same_id')
    expect(catalog.errors[0]).toContain('skills/first.skill.yaml')
  })

  it('collects invalid YAML skill errors without dropping valid builtins', () => {
    const catalog = buildSkillCatalog([builtinEntry], [
      {
        path: 'broken.skill.yaml',
        source: `
id: broken
name: Broken
version: 0.1.0
category: rewrite
description: broken
risk_level: medium
output:
  mode: direct_write
`,
      },
    ])

    expect(catalog.skills).toHaveLength(1)
    expect(catalog.errors[0]).toContain('broken.skill.yaml')
    expect(catalog.errors[0]).toContain('output.mode')
  })

  it('loads project skill files after bundled YAML so local manifests can override', async () => {
    const catalog = await loadProjectSkillCatalog({
      projectRoot: '/novels/demo',
      isTauri: () => true,
      scanSkills: async () => [
        {
          file_path: 'skills/local/dialogue.skill.yaml',
          content: `
id: xuanhuan.dialogue_polish
name: 本地对白润色
version: 0.3.0
category: rewrite
description: 项目本地版本。
risk_level: medium
output:
  mode: rewrite_patch
  schema: diff_patch
safety:
  require_snapshot_before_apply: true
  require_user_review: true
`,
        },
      ],
    })

    const rewriteSkill = findRewriteSkill(catalog)

    expect(catalog.errors).toEqual([])
    expect(rewriteSkill).toMatchObject({
      name: '本地对白润色',
      version: '0.3.0',
    })
    expect(
      catalog.skills.find((entry) => entry.manifest.id === 'xuanhuan.dialogue_polish'),
    ).toMatchObject({
      source: 'project_yaml',
      path: 'skills/local/dialogue.skill.yaml',
    })
  })

  it('labels Skill sources for UI and Agent inspection', async () => {
    const catalog = await loadProjectSkillCatalog({
      projectRoot: '/novels/demo',
      isTauri: () => true,
      scanSkills: async () => [
        {
          file_path: 'skills/local/review.skill.yaml',
          content: `
id: demo.local_review
name: 本地体检
version: 0.1.0
category: memory
description: 项目本地 Skill。
risk_level: medium
output:
  mode: report
  schema: report
safety:
  require_user_review: true
`,
        },
      ],
    })
    const localEntry = catalog.skills.find(
      (entry) => entry.manifest.id === 'demo.local_review',
    )
    const bundledEntry = catalog.skills.find(
      (entry) => entry.manifest.id === 'xuanhuan.dialogue_polish',
    )

    expect(formatSkillCatalogSource('builtin')).toBe('内置')
    expect(formatSkillCatalogSource('bundled_yaml')).toBe('示例')
    expect(formatSkillCatalogSource('project_yaml')).toBe('项目')
    expect(localEntry && describeSkillCatalogSource(localEntry)).toBe(
      '项目 · skills/local/review.skill.yaml',
    )
    expect(bundledEntry && describeSkillCatalogSource(bundledEntry)).toContain(
      '示例 · examples/skills/',
    )
  })

  it('summarizes and filters Skill entries by source', async () => {
    const catalog = await loadProjectSkillCatalog({
      projectRoot: '/novels/demo',
      isTauri: () => true,
      scanSkills: async () => [
        {
          file_path: 'skills/local/review.skill.yaml',
          content: `
id: demo.local_review
name: 本地体检
version: 0.1.0
category: memory
description: 项目本地 Skill。
risk_level: medium
output:
  mode: report
  schema: report
safety:
  require_user_review: true
`,
        },
      ],
    })

    expect(summarizeSkillCatalogSources(catalog.skills)).toMatchObject({
      all: 6,
      builtin: 3,
      bundled_yaml: 2,
      project_yaml: 1,
    })
    expect(
      filterSkillCatalogEntriesBySource(catalog.skills, 'project_yaml').map(
        (entry) => entry.manifest.id,
      ),
    ).toEqual(['demo.local_review'])
    expect(filterSkillCatalogEntriesBySource(catalog.skills, 'all')).toHaveLength(
      catalog.skills.length,
    )
  })

  it('falls back to bundled skills and reports project skill scan failures', async () => {
    const catalog = await loadProjectSkillCatalog({
      projectRoot: '/novels/demo',
      isTauri: () => true,
      scanSkills: async () => {
        throw new Error('permission denied')
      },
    })

    expect(findRewriteSkill(catalog)?.name).toBe('玄幻对白润色')
    expect(catalog.errors[0]).toContain('skills/: permission denied')
  })
})
