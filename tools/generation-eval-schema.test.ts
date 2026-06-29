import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('generation eval schema', () => {
  it('ships a public schema for real-generation benchmark criteria', async () => {
    const generationEvalSchemaSource = await readFile(
      join(process.cwd(), 'schemas', 'generation-eval.schema.json'),
      'utf8',
    )
    const schema = JSON.parse(generationEvalSchemaSource) as {
      required: string[]
      properties: {
        criteria: {
          minItems: number
        }
      }
      $defs: {
        criterionCategory: {
          enum: string[]
        }
        criterion: {
          required: string[]
          additionalProperties: boolean
          anyOf: Array<{ required: string[] }>
          properties: {
            contains: {
              minItems: number
            }
            contains_any: {
              minItems: number
            }
            not_contains: {
              minItems: number
            }
          }
        }
      }
    }

    expect(schema.required).toEqual(['instruction', 'criteria'])
    expect(schema.properties.criteria.minItems).toBe(1)
    expect(schema.$defs.criterionCategory.enum).toEqual([
      'callback',
      'setting',
      'future_leak',
    ])
    expect(schema.$defs.criterion.required).toEqual([
      'id',
      'description',
      'category',
    ])
    expect(schema.$defs.criterion.additionalProperties).toBe(false)
    expect(schema.$defs.criterion.anyOf).toEqual([
      { required: ['contains'] },
      { required: ['contains_any'] },
      { required: ['not_contains'] },
    ])
    expect(schema.$defs.criterion.properties.contains.minItems).toBe(1)
    expect(schema.$defs.criterion.properties.contains_any.minItems).toBe(1)
    expect(schema.$defs.criterion.properties.not_contains.minItems).toBe(1)
  })

  it('keeps the long-memory generation eval config linked to the public schema', async () => {
    const source = await readFile(
      join(
        process.cwd(),
        'examples',
        'long-memory-benchmark',
        'meta',
        'generation-eval.json',
      ),
      'utf8',
    )
    const raw = JSON.parse(source) as { $schema?: string }

    expect(raw.$schema).toBe('../../../schemas/generation-eval.schema.json')
  })
})
