import { describe, expect, it } from 'vitest'
import skillSchemaSource from '../../schemas/skill.schema.json?raw'
import skillTemplateSource from '../../examples/skills/skill-template.yaml?raw'
import { parseSkillManifest } from './skillManifest'

describe('skill manifest parser', () => {
  it('keeps the community Skill template parseable', () => {
    const result = parseSkillManifest(skillTemplateSource)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.manifest.id).toBe('community.example_skill')
      expect(result.manifest.outputSchema).toBe('diff_patch')
      expect(result.manifest.input?.required).toEqual(['nearby_text'])
      expect(result.manifest.input?.optional).toContain('recall_audit')
      expect(result.manifest.retrieval?.includeRecall).toBe('auto')
    }
  })

  it('ships a JSON schema with the supported input names', () => {
    const schema = JSON.parse(skillSchemaSource) as {
      $defs: {
        inputName: {
          enum: string[]
        }
        memorySourceFamily: {
          enum: string[]
        }
      }
      properties: {
        retrieval: {
          properties: {
            include_recall?: unknown
            source_families?: unknown
          }
        }
        output: {
          properties: {
            schema: {
              enum: string[]
            }
          }
        }
      }
      allOf: unknown[]
    }

    expect(schema.$defs.inputName.enum).toContain('nearby_text')
    expect(schema.$defs.inputName.enum).toContain('recall_audit')
    expect(schema.$defs.inputName.enum).toContain('user_instruction')
    expect(schema.$defs.memorySourceFamily.enum).toContain('manuscript')
    expect(schema.$defs.memorySourceFamily.enum).toContain('recall')
    expect(schema.properties.retrieval.properties.include_recall).toBeTruthy()
    expect(schema.properties.retrieval.properties.source_families).toBeTruthy()
    expect(schema.properties.output.properties.schema.enum).toContain(
      'plot_thread_proposal',
    )
    expect(schema.allOf.length).toBeGreaterThanOrEqual(4)
  })

  it('parses a safe YAML skill manifest', () => {
    const result = parseSkillManifest(`
id: xuanhuan.dialogue_polish
name: 玄幻对白润色
version: 0.1.0
category: rewrite
description: 保持人物身份和境界压迫感，润色选中对白。
risk_level: medium
output:
  mode: rewrite_patch
  schema: diff_patch
model:
  profile: balanced
  temperature: 0.7
retrieval:
  include_recent_chapters: 1
  include_characters: auto
  include_worldbuilding: none
  include_recall: none
  source_families:
    - manuscript
    - codex
input:
  required: [selected_text, nearby_text]
  optional: [chapter_summary]
prompt: |
  保持人物身份和境界压迫感。
safety:
  require_snapshot_before_apply: true
  require_user_review: true
`)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.manifest.outputMode).toBe('rewrite_patch')
      expect(result.manifest.outputSchema).toBe('diff_patch')
      expect(result.manifest.requiresReview).toBe(true)
      expect(result.manifest.prompt).toContain('境界压迫感')
      expect(result.manifest.input).toEqual({
        required: ['selected_text', 'nearby_text'],
        optional: ['chapter_summary'],
      })
      expect(result.manifest.retrieval).toEqual({
        includeRecentChapters: 1,
        includeCharacters: 'auto',
        includeWorldbuilding: 'none',
        includeRecall: 'none',
        sourceFamilies: ['manuscript', 'codex'],
      })
      expect(result.manifest.model).toEqual({
        profile: 'balanced',
        temperature: 0.7,
      })
    }
  })

  it('rejects unknown output modes', () => {
    const result = parseSkillManifest(`
id: unsafe.skill
name: Unsafe
version: 0.1.0
category: rewrite
description: Bad output mode.
risk_level: medium
output:
  mode: direct_write
`)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.join('\n')).toContain('output.mode 必须是')
    }
  })

  it('requires snapshots and user review for rewrite patch skills', () => {
    const result = parseSkillManifest(`
id: unsafe.rewrite
name: Unsafe Rewrite
version: 0.1.0
category: rewrite
description: Missing snapshot safety.
risk_level: medium
output:
  mode: rewrite_patch
  schema: diff_patch
safety:
  require_user_review: false
`)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      const errors = result.errors.join('\n')
      expect(errors).toContain('require_snapshot_before_apply')
      expect(errors).toContain('不能将 safety.require_user_review 设为 false')
    }
  })

  it('rejects output schema values that do not match the output mode', () => {
    const result = parseSkillManifest(`
id: unsafe.schema
name: Unsafe Schema
version: 0.1.0
category: rewrite
description: Declares a mismatched schema.
risk_level: medium
output:
  mode: rewrite_patch
  schema: plot_thread_proposal
safety:
  require_snapshot_before_apply: true
  require_user_review: true
`)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.join('\n')).toContain(
        'output.schema 与 output.mode 不匹配',
      )
      expect(result.errors.join('\n')).toContain('rewrite_patch 只能使用: diff_patch')
    }
  })

  it('requires output schema so runtime contracts stay explicit', () => {
    const result = parseSkillManifest(`
id: missing.schema
name: Missing Schema
version: 0.1.0
category: report
description: Omits the output schema.
risk_level: low
output:
  mode: report
`)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.join('\n')).toContain('output.schema 必须是非空字符串')
    }
  })

  it('requires user review for memory update proposal skills', () => {
    const result = parseSkillManifest(`
id: unsafe.memory
name: Unsafe Memory
version: 0.1.0
category: memory
description: Turns off review for memory mutation proposals.
risk_level: high
output:
  mode: memory_update_proposal
  schema: mixed_memory_update
safety:
  require_user_review: false
`)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.join('\n')).toContain(
        '不能将 safety.require_user_review 设为 false',
      )
    }
  })

  it('rejects unknown model profiles', () => {
    const result = parseSkillManifest(`
id: unsafe.profile
name: Unsafe Profile
version: 0.1.0
category: rewrite
description: Bad model profile.
risk_level: medium
model:
  profile: unlimited
output:
  mode: report
  schema: report
`)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.join('\n')).toContain('model.profile 必须是')
    }
  })

  it('rejects unknown input names so community skills fail early', () => {
    const result = parseSkillManifest(`
id: typo.input
name: Typo Input
version: 0.1.0
category: rewrite
description: Bad input name.
risk_level: medium
input:
  required: [nearby_text, chapter_summry]
output:
  mode: report
  schema: report
`)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.join('\n')).toContain('未知输入: chapter_summry')
    }
  })

  it('rejects duplicate input names to match the public JSON schema', () => {
    const result = parseSkillManifest(`
id: duplicate.input
name: Duplicate Input
version: 0.1.0
category: rewrite
description: Duplicates input declarations.
risk_level: medium
input:
  required: [nearby_text, nearby_text]
  optional: [chapter_summary, chapter_summary]
output:
  mode: report
  schema: report
`)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      const errors = result.errors.join('\n')
      expect(errors).toContain('input.required 不能包含重复项: nearby_text')
      expect(errors).toContain('input.optional 不能包含重复项: chapter_summary')
    }
  })

  it('rejects required recent style when recent chapter retrieval is disabled', () => {
    const result = parseSkillManifest(`
id: contradiction.recent_style
name: Contradictory Recent Style
version: 0.1.0
category: rewrite
description: Requires recent style while disabling recent chapter retrieval.
risk_level: medium
input:
  required: [recent_style]
retrieval:
  include_recent_chapters: 0
output:
  mode: report
  schema: report
`)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.join('\n')).toContain(
        'input.required 包含 recent_style 时，retrieval.include_recent_chapters 不能为 0',
      )
    }
  })

  it('rejects required character cards when character retrieval is disabled', () => {
    const result = parseSkillManifest(`
id: contradiction.characters
name: Contradictory Characters
version: 0.1.0
category: rewrite
description: Requires character cards while disabling character retrieval.
risk_level: medium
input:
  required: [character_cards]
retrieval:
  include_characters: none
output:
  mode: report
  schema: report
`)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors.join('\n')).toContain(
        'input.required 包含 character_cards 时，retrieval.include_characters 不能为 none',
      )
    }
  })

  it('allows optional inputs to be disabled by retrieval policy', () => {
    const result = parseSkillManifest(`
id: optional.reduced_context
name: Optional Reduced Context
version: 0.1.0
category: report
description: Optional context can be intentionally omitted.
risk_level: low
input:
  optional: [recent_style, character_cards]
retrieval:
  include_recent_chapters: 0
  include_characters: none
output:
  mode: report
  schema: report
`)

    expect(result.ok).toBe(true)
  })

  it('parses source family retrieval filters for community Skills', () => {
    const result = parseSkillManifest(`
id: focused.recall_report
name: Focused Recall Report
version: 0.1.0
category: memory
description: Reads only stable codex and recall evidence.
risk_level: low
retrieval:
  source_families:
    - codex
    - recall
    - plot_thread
output:
  mode: report
  schema: report
`)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.manifest.retrieval?.sourceFamilies).toEqual([
        'codex',
        'recall',
        'plot_thread',
      ])
    }
  })

  it('rejects invalid, empty, and duplicate source family filters', () => {
    const invalid = parseSkillManifest(`
id: invalid.source_family
name: Invalid Source Family
version: 0.1.0
category: memory
description: Uses an unsupported source family.
risk_level: low
retrieval:
  source_families:
    - vector_memory
output:
  mode: report
  schema: report
`)
    const empty = parseSkillManifest(`
id: empty.source_family
name: Empty Source Family
version: 0.1.0
category: memory
description: Uses an empty source family filter.
risk_level: low
retrieval:
  source_families: []
output:
  mode: report
  schema: report
`)
    const duplicate = parseSkillManifest(`
id: duplicate.source_family
name: Duplicate Source Family
version: 0.1.0
category: memory
description: Repeats a source family.
risk_level: low
retrieval:
  source_families:
    - recall
    - recall
output:
  mode: report
  schema: report
`)

    expect(invalid.ok).toBe(false)
    if (!invalid.ok) {
      expect(invalid.errors.join('\n')).toContain(
        'retrieval.source_families 必须是非空数组',
      )
    }

    expect(empty.ok).toBe(false)
    if (!empty.ok) {
      expect(empty.errors.join('\n')).toContain(
        'retrieval.source_families 必须是非空数组',
      )
    }

    expect(duplicate.ok).toBe(false)
    if (!duplicate.ok) {
      expect(duplicate.errors.join('\n')).toContain(
        'retrieval.source_families 不能包含重复项: recall',
      )
    }
  })

  it('rejects required inputs that source family filters make impossible', () => {
    const recentStyle = parseSkillManifest(`
id: contradiction.source_recent
name: Source Recent Contradiction
version: 0.1.0
category: rewrite
description: Requires recent prose while excluding manuscript sources.
risk_level: medium
input:
  required: [recent_style]
retrieval:
  source_families:
    - codex
output:
  mode: report
  schema: report
`)
    const characterCards = parseSkillManifest(`
id: contradiction.source_character
name: Source Character Contradiction
version: 0.1.0
category: rewrite
description: Requires character cards while excluding codex and state sources.
risk_level: medium
input:
  required: [character_cards]
retrieval:
  source_families:
    - manuscript
output:
  mode: report
  schema: report
`)
    const recallAudit = parseSkillManifest(`
id: contradiction.source_recall
name: Source Recall Contradiction
version: 0.1.0
category: memory
description: Requires recall audit while disabling recall and excluding project metadata.
risk_level: low
input:
  required: [recall_audit]
retrieval:
  include_recall: none
  source_families:
    - recall
output:
  mode: report
  schema: report
`)

    expect(recentStyle.ok).toBe(false)
    if (!recentStyle.ok) {
      expect(recentStyle.errors.join('\n')).toContain(
        'input.required 包含 recent_style 时，retrieval.source_families 必须包含: manuscript 之一',
      )
    }

    expect(characterCards.ok).toBe(false)
    if (!characterCards.ok) {
      expect(characterCards.errors.join('\n')).toContain(
        'input.required 包含 character_cards 时，retrieval.source_families 必须包含: codex、character_state_log 之一',
      )
    }

    expect(recallAudit.ok).toBe(false)
    if (!recallAudit.ok) {
      expect(recallAudit.errors.join('\n')).toContain(
        'input.required 包含 recall_audit 且 retrieval.include_recall 为 none 时，retrieval.source_families 必须包含 project',
      )
    }
  })

  it('allows optional inputs and satisfiable required inputs with source family filters', () => {
    const result = parseSkillManifest(`
id: focused.source_contract
name: Focused Source Contract
version: 0.1.0
category: memory
description: Keeps required plot memory satisfiable while optional inputs are filtered out.
risk_level: low
input:
  required: [plot_memory]
  optional: [recent_style, character_cards]
retrieval:
  include_recent_chapters: 0
  include_characters: none
  source_families:
    - chapter_summary
    - plot_thread
output:
  mode: report
  schema: report
`)

    expect(result.ok).toBe(true)
  })

  it('keeps parser validation aligned with the public Skill JSON schema', () => {
    const result = parseSkillManifest(`
id: Bad Skill
name: Bad Skill
version: 0.1.0
category: rewrite
description: Violates schema-shaped parser rules.
risk_level: medium
input:
  required: [nearby_text, 42]
retrieval:
  include_recent_chapters: -1
model:
  temperature: 3
output:
  mode: report
  schema: report
`)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      const errors = result.errors.join('\n')
      expect(errors).toContain('id 只能使用小写字母')
      expect(errors).toContain('input.required 必须是字符串数组')
      expect(errors).toContain('retrieval.include_recent_chapters 必须是')
      expect(errors).toContain('model.temperature 必须是 0 到 2')
    }
  })
})
