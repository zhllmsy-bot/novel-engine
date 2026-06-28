import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('project manifest schema', () => {
  it('ships a public schema for Markdown-first project manifests', async () => {
    const projectSchemaSource = await readFile(
      join(process.cwd(), 'schemas', 'project.schema.json'),
      'utf8',
    )
    const schema = JSON.parse(projectSchemaSource) as {
      required: string[]
      additionalProperties: boolean
      properties: {
        schema_version: { const: number }
        source_of_truth: { const: string }
        chapters: { items: { $ref: string } }
      }
      $defs: {
        chapter: {
          required: string[]
          additionalProperties: boolean
          properties: {
            id: { pattern: string }
            path: { minLength: number; pattern: string }
            order: { type: string; minimum: number }
          }
        }
      }
    }

    expect(schema.required).toEqual([
      'schema_version',
      'title',
      'source_of_truth',
      'chapters',
    ])
    expect(schema.additionalProperties).toBe(false)
    expect(schema.properties.schema_version.const).toBe(1)
    expect(schema.properties.source_of_truth.const).toBe('markdown')
    expect(schema.properties.chapters.items.$ref).toBe('#/$defs/chapter')
    expect(schema.$defs.chapter.required).toEqual(['path', 'order'])
    expect(schema.$defs.chapter.additionalProperties).toBe(false)
    expect(schema.$defs.chapter.properties.id.pattern).toBe(
      '^[a-z0-9][a-z0-9_.-]*$',
    )
    expect(schema.$defs.chapter.properties.path.minLength).toBe(1)
    expect(schema.$defs.chapter.properties.path.pattern).toContain('md')
    expect(schema.$defs.chapter.properties.order).toMatchObject({
      type: 'integer',
      minimum: 1,
    })
  })

  it('keeps the demo project manifest linked to the public schema', async () => {
    const demoProjectSource = await readFile(
      join(process.cwd(), 'examples', 'demo-novel', 'meta', 'project.json'),
      'utf8',
    )
    const raw = JSON.parse(demoProjectSource) as { $schema?: string }

    expect(raw.$schema).toBe('../../../schemas/project.schema.json')
  })
})
