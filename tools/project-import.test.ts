import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { checkNovelProject } from './project-check.ts'
import {
  buildProjectManifest,
  discoverSourceChapters,
  importExistingNovelProject,
  parseProjectImportArgs,
} from './project-import.ts'

async function writeExistingNovelPackage(root: string) {
  await mkdir(join(root, 'chapters'), { recursive: true })
  await mkdir(join(root, 'ledgers'), { recursive: true })
  await mkdir(join(root, 'upload'), { recursive: true })
  await writeFile(
    join(root, 'README.md'),
    `# 《旧稿项目包》

当前交付：前 2 章正文。
`,
  )
  await writeFile(
    join(root, 'bible.md'),
    `# Bible

## Protagonist

- Name: 林砚
- Public flaw: 被当成坏学生。
- Hidden strength: 观察细。
- Long desire: 让母亲不用再熬夜摆摊。
- Fear: 被看不见的系统吞掉。
`,
  )
  await writeFile(
    join(root, 'chapters', '001.md'),
    '# 第一章 被点名的坏学生\n\n林砚被叫上讲台。',
  )
  await writeFile(
    join(root, 'chapters', '002.md'),
    '# 第二章 红线落下之前\n\n林砚看见了风险线。',
  )
  await writeFile(
    join(root, 'chapters', '003.md'),
    '# 第三章 工印四号\n\n下一步路径指向 HOOK-03。',
  )
  await writeFile(
    join(root, 'ledgers', 'promises.jsonl'),
    '{"chapter":1,"promise":"林砚要洗清嫌疑。","status":"open"}\n',
  )
  await writeFile(join(root, 'ledgers', 'timeline.md'), '# Timeline\n\n- 第一天。')
  await writeFile(join(root, 'upload', 'package.md'), '# Upload\n')
}

describe('project import tool', () => {
  it('discovers numbered source chapters in order', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'project-import-'))

    try {
      await writeExistingNovelPackage(parent)
      const chapters = await discoverSourceChapters(parent)

      expect(chapters.map((chapter) => chapter.number)).toEqual([1, 2, 3])
      expect(chapters[2].content).toContain('HOOK-03')
    } finally {
      await rm(parent, { recursive: true, force: true })
    }
  })

  it('builds a manifest with imported chapters and a project-local schema', () => {
    const source = buildProjectManifest({
      outputPath: '/novels/Imported',
      title: '导入旧稿',
      chapters: [
        {
          sourcePath: '/old/001.md',
          targetPath: 'manuscript/volume-001/chapter-001.md',
          id: 'chapter-001',
          title: '第一章',
          order: 1,
          content: '# 第一章\n\n正文',
        },
      ],
    })
    const manifest = JSON.parse(source) as {
      $schema: string
      title: string
      chapters: Array<{ id: string; title: string; path: string; order: number }>
    }

    expect(manifest.$schema).toBe('../.novel/schemas/project.schema.json')
    expect(manifest.title).toBe('导入旧稿')
    expect(manifest.chapters).toEqual([
      {
        id: 'chapter-001',
        title: '第一章',
        path: 'manuscript/volume-001/chapter-001.md',
        order: 1,
      },
    ])
  })

  it('imports an existing package into a checkable Novel Engine project', async () => {
    const parent = await mkdtemp(join(tmpdir(), 'project-import-'))
    const sourceRoot = join(parent, 'source')
    const outputRoot = join(parent, 'ImportedNovel')

    try {
      await writeExistingNovelPackage(sourceRoot)
      const imported = await importExistingNovelProject({
        sourcePath: sourceRoot,
        outputPath: outputRoot,
        title: '我能看见风险',
        force: false,
        chaptersPerVolume: 2,
        help: false,
      })
      const projectReport = await checkNovelProject(outputRoot)
      const continuationState = await readFile(
        join(outputRoot, 'codex', 'notes', 'continuation-state.md'),
        'utf8',
      )
      const importReport = await readFile(
        join(outputRoot, 'references', 'import-report.md'),
        'utf8',
      )
      const protagonistCard = await readFile(
        join(outputRoot, 'codex', '00-core', '6797-781a.md'),
        'utf8',
      )

      expect(imported).toMatchObject({
        title: '我能看见风险',
        latestChapter: {
          id: 'chapter-003',
          title: '第三章 工印四号',
          path: 'manuscript/volume-002/chapter-003.md',
          order: 3,
        },
        nextChapterPath: 'manuscript/volume-002/chapter-004.md',
      })
      expect(imported.warnings.join('\n')).toContain(
        'source README claims 2 chapters, but 3 chapter files were imported.',
      )
      expect(projectReport.ok).toBe(true)
      expect(projectReport.stats.chapters).toBe(3)
      expect(projectReport.stats.codexEntries).toBeGreaterThanOrEqual(5)
      expect(projectReport.stats.memoryEvalExpectations).toBe(2)
      expect(continuationState).toContain('第 4 章')
      expect(continuationState).toContain('HOOK-03')
      expect(importReport).toContain('Imported chapters: 3')
      expect(importReport).toContain('README claims 2 chapters')
      expect(protagonistCard).toContain('name: "林砚"')
    } finally {
      await rm(parent, { recursive: true, force: true })
    }
  })

  it('parses CLI options and validates required flags', () => {
    const options = parseProjectImportArgs([
      '--from',
      'old',
      '--out',
      'new',
      '--title',
      '导入旧稿',
      '--chapters-per-volume',
      '20',
      '--force',
    ])

    expect(options).toMatchObject({
      sourcePath: join(process.cwd(), 'old'),
      outputPath: join(process.cwd(), 'new'),
      title: '导入旧稿',
      chaptersPerVolume: 20,
      force: true,
      help: false,
    })
    expect(() => parseProjectImportArgs(['--out', 'new'])).toThrow(
      '--from is required.',
    )
    expect(() => parseProjectImportArgs(['--from', 'old'])).toThrow(
      '--out is required.',
    )
    expect(() =>
      parseProjectImportArgs([
        '--from',
        'old',
        '--out',
        'new',
        '--chapters-per-volume',
        '0',
      ]),
    ).toThrow('--chapters-per-volume must be a positive integer.')
  })
})
