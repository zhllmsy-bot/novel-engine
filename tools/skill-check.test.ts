import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  checkSkillManifests,
  collectSkillManifestFiles,
  formatSkillCheckReport,
} from './skill-check.ts'

const validSkill = `
id: community.valid
name: Valid Skill
version: 0.1.0
category: analysis
description: Validates a chapter.
risk_level: low
output:
  mode: report
  schema: report
`

const invalidSkill = `
id: community.invalid
name: Invalid Skill
version: 0.1.0
category: analysis
description: Invalid input name.
risk_level: low
input:
  required: [chapter_summry]
output:
  mode: report
  schema: report
`

describe('skill check tool', () => {
  it('collects only Skill manifest files recursively', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skill-check-'))
    const skillsDir = join(root, 'skills', 'local')
    await mkdir(skillsDir, { recursive: true })
    await writeFile(join(skillsDir, 'valid.skill.yaml'), validSkill)
    await writeFile(join(skillsDir, 'notes.yaml'), validSkill)

    try {
      await expect(collectSkillManifestFiles([root])).resolves.toEqual([
        join(skillsDir, 'valid.skill.yaml'),
      ])
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('reports valid and invalid manifests using the shared parser', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skill-check-'))
    await writeFile(join(root, 'valid.skill.yaml'), validSkill)
    await writeFile(join(root, 'invalid.skill.yaml'), invalidSkill)

    try {
      const report = await checkSkillManifests([root])
      const output = formatSkillCheckReport(report)

      expect(report.checked).toBe(2)
      expect(report.passed).toBe(1)
      expect(report.failed).toBe(1)
      expect(output).toContain('Skill check: 1/2 passed')
      expect(output).toContain('未知输入: chapter_summry')
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it('fails repeated Skill ids across checked manifests', async () => {
    const root = await mkdtemp(join(tmpdir(), 'skill-check-'))
    const firstPath = join(root, 'first.skill.yaml')
    const secondPath = join(root, 'second.skill.yaml')
    const duplicateSkill = (name: string) => `
id: community.duplicate
name: ${name}
version: 0.1.0
category: analysis
description: Duplicate id.
risk_level: low
output:
  mode: report
  schema: report
`
    await writeFile(firstPath, duplicateSkill('First Skill'))
    await writeFile(secondPath, duplicateSkill('Second Skill'))

    try {
      const report = await checkSkillManifests([root])
      const output = formatSkillCheckReport(report)

      expect(report.checked).toBe(2)
      expect(report.passed).toBe(1)
      expect(report.failed).toBe(1)
      expect(output).toContain('duplicate Skill id community.duplicate')
      expect(output).toContain(firstPath)
    } finally {
      await rm(root, { recursive: true, force: true })
    }
  })
})
