import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  diagnoseGenerationL1,
  formatGenerationL1Diagnosis,
  parseGenerationL1DiagnoseArgs,
} from './generation-l1-diagnose.ts'

describe('generation L1 diagnosis tool', () => {
  it('classifies oracle-covered recall missed by local L1 summaries', async () => {
    const root = await mkdtemp(join(tmpdir(), 'generation-l1-gap-'))
    const projectRoot = join(root, 'l1-gap-benchmark')

    try {
      await writeDiagnosticProject(projectRoot, { includeFixture: true })

      const report = await diagnoseGenerationL1({
        benchmarkProjects: [projectRoot],
      })
      const criterion = report.cases[0].criteria.find(
        (candidate) => candidate.criterionId === 'callback-hidden-oath',
      )
      const output = formatGenerationL1Diagnosis(report)

      expect(report.ok).toBe(true)
      expect(report.analyzedCases).toBe(1)
      expect(report.aggregate.positiveCriteria).toBe(1)
      expect(criterion).toMatchObject({
        classification: 'local-l1-summary-gap',
        localSummaryCovered: false,
        causalSummaryCovered: true,
        baselinePromptCovered: false,
        recentFillPromptCovered: false,
      })
      expect(output).toContain('local-l1-summary-gap')
      expect(output).toContain('callback-hidden-oath')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('skips projects without causal fixtures instead of failing the fixture suite', async () => {
    const root = await mkdtemp(join(tmpdir(), 'generation-l1-missing-fixture-'))
    const projectRoot = join(root, 'no-fixture-benchmark')

    try {
      await writeDiagnosticProject(projectRoot, { includeFixture: false })

      const report = await diagnoseGenerationL1({
        benchmarkProjects: [projectRoot],
      })

      expect(report.ok).toBe(false)
      expect(report.analyzedCases).toBe(0)
      expect(report.skippedProjects).toEqual([
        {
          rootPath: projectRoot,
          reason: 'missing-causal-fixture',
        },
      ])
      expect(formatGenerationL1Diagnosis(report)).toContain(
        'missing-causal-fixture',
      )
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('parses benchmark, json, and output options', () => {
    expect(
      parseGenerationL1DiagnoseArgs([
        '--benchmark-project',
        'examples/a',
        '--project',
        'examples/b',
        '--out',
        '.novel/evals/l1.json',
        '--json',
      ]),
    ).toMatchObject({
      benchmarkProjects: ['examples/a', 'examples/b'],
      outPath: '.novel/evals/l1.json',
      json: true,
    })
  })
})

async function writeDiagnosticProject(
  projectRoot: string,
  input: { includeFixture: boolean },
) {
  await mkdir(join(projectRoot, 'meta'), { recursive: true })
  await mkdir(join(projectRoot, 'manuscript', 'volume-001'), {
    recursive: true,
  })
  await mkdir(join(projectRoot, 'codex', 'notes'), { recursive: true })

  await writeFile(
    join(projectRoot, 'meta', 'project.json'),
    JSON.stringify(
      {
        title: 'L1 诊断测试',
        source_of_truth: 'markdown',
        chapters: [
          {
            id: 'chapter-001',
            title: '第001章 夜契',
            path: 'manuscript/volume-001/chapter-001.md',
            order: 1,
          },
          {
            id: 'chapter-002',
            title: '第002章 雨棚',
            path: 'manuscript/volume-001/chapter-002.md',
            order: 2,
          },
          {
            id: 'chapter-003',
            title: '第003章 灯线',
            path: 'manuscript/volume-001/chapter-003.md',
            order: 3,
          },
          {
            id: 'chapter-004',
            title: '第004章 回声',
            path: 'manuscript/volume-001/chapter-004.md',
            order: 4,
          },
        ],
      },
      null,
      2,
    ),
  )

  await writeFile(
    join(projectRoot, 'meta', 'generation-eval.json'),
    JSON.stringify(
      {
        $schema: '../../../schemas/generation-eval.schema.json',
        chapter_id: 'chapter-004',
        budget_chars: 160,
        instruction: '请接着第004章续写沈泊解释旧约的一小段。只输出正文。',
        max_output_chars: 300,
        criteria: [
          {
            id: 'callback-hidden-oath',
            description: 'Recall the buried causal oath from early L1.',
            category: 'callback',
            contains_any: ['银针逆誓'],
          },
        ],
      },
      null,
      2,
    ),
  )

  if (input.includeFixture) {
    await writeFile(
      join(projectRoot, 'meta', 'l1-ablation-summaries.json'),
      JSON.stringify(
        {
          summaries: [
            {
              chapter_id: 'chapter-001',
              summary: '沈泊立下银针逆誓：若旧约重启，他必须先承认自己当年没有逃走。',
              key_events: ['银针逆誓约束沈泊之后的选择'],
              characters_involved: ['shen-bo'],
            },
            {
              chapter_id: 'chapter-002',
              summary: '沈泊在雨棚下避开追问。',
            },
            {
              chapter_id: 'chapter-003',
              summary: '灯线被风吹暗。',
            },
            {
              chapter_id: 'chapter-004',
              summary: '旧约再次被提起。',
            },
          ],
        },
        null,
        2,
      ),
    )
  }

  await writeFile(
    join(projectRoot, 'manuscript', 'volume-001', 'chapter-001.md'),
    [
      '# 第001章 夜契',
      '',
      '沈泊在桥边停下，听见远处鼓声。',
      '他把灯罩扣紧，只说今晚不要惊动任何人。',
      '银针逆誓被他压在袖中，像一行无人抄录的小字。',
      '雨水沿着石阶往下淌，没人再提旧事。',
      '更夫经过街口，随手拨亮一盏残灯。',
      '最后他转身离开，没有解释自己为何沉默。',
    ].join('\n'),
  )
  await writeFile(
    join(projectRoot, 'manuscript', 'volume-001', 'chapter-002.md'),
    '# 第002章 雨棚\n\n沈泊在雨棚下避开追问，只说旧约还不到解释的时候。\n',
  )
  await writeFile(
    join(projectRoot, 'manuscript', 'volume-001', 'chapter-003.md'),
    '# 第003章 灯线\n\n灯线被风吹暗，简璃问他是否还记得桥边那晚。\n',
  )
  await writeFile(
    join(projectRoot, 'manuscript', 'volume-001', 'chapter-004.md'),
    '# 第004章 回声\n\n旧约再次被提起，沈泊看着灯影沉默。\n',
  )
  await writeFile(
    join(projectRoot, 'codex', 'notes', 'oath.md'),
    '---\nid: oath-note\nname: 旧约\ntype: note\nkeywords: [旧约, 沈泊]\n---\n\n旧约会约束沈泊面对过去的选择。\n',
  )
}
