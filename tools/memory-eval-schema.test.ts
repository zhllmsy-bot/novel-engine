import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('memory eval schema', () => {
  it('ships a public schema for project-local recall expectations', async () => {
    const memoryEvalSchemaSource = await readFile(
      join(process.cwd(), 'schemas', 'memory-eval.schema.json'),
      'utf8',
    )
    const schema = JSON.parse(memoryEvalSchemaSource) as {
      required: string[]
      properties: {
        expectations: {
          minItems: number
        }
      }
      $defs: {
        memoryLayer: {
          enum: string[]
        }
        expectation: {
          required: string[]
          additionalProperties: boolean
          properties: {
            not_contains: {
              minItems: number
            }
            source_contains: {
              minItems: number
            }
          }
        }
      }
    }

    expect(schema.required).toContain('expectations')
    expect(schema.properties.expectations.minItems).toBe(1)
    expect(schema.$defs.memoryLayer.enum).toEqual([
      'L0 事实',
      'L1 剧情',
      'L2 风格',
      'L3 意图',
    ])
    expect(schema.$defs.expectation.required).toEqual([
      'id',
      'description',
      'contains',
    ])
    expect(schema.$defs.expectation.additionalProperties).toBe(false)
    expect(schema.$defs.expectation.properties.not_contains.minItems).toBe(1)
    expect(schema.$defs.expectation.properties.source_contains.minItems).toBe(1)
  })

  it('keeps the demo memory eval config linked to the public schema', async () => {
    const demoMemoryEvalSource = await readFile(
      join(process.cwd(), 'examples', 'demo-novel', 'meta', 'memory-eval.json'),
      'utf8',
    )
    const raw = JSON.parse(demoMemoryEvalSource) as { $schema?: string }

    expect(raw.$schema).toBe('../../../schemas/memory-eval.schema.json')
  })
})
