import { describe, expect, it } from 'vitest'
import {
  checkExtensions,
  formatExtensionCheckReport,
} from './extensions-check.ts'

describe('extensions check tool', () => {
  it('checks bundled extension examples and contribution templates together', async () => {
    const report = await checkExtensions()
    const output = formatExtensionCheckReport(report)

    expect(report.ok).toBe(true)
    expect(report.checked).toBe(9)
    expect(report.passed).toBe(9)
    expect(report.failed).toBe(0)
    expect(report.skills.checked).toBe(3)
    expect(report.providers.checked).toBe(3)
    expect(report.publishers.checked).toBe(3)
    expect(output).toContain('Extension check: OK (9/9 passed)')
    expect(output).toContain('examples/skills/skill-template.yaml')
    expect(output).toContain(
      'examples/adapters/provider-adapter-template/provider.adapter.json',
    )
    expect(output).toContain(
      'examples/adapters/publisher-adapter-template/publisher.adapter.json',
    )
  })
})
