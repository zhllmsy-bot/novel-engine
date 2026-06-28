import { z } from 'zod'
import type { ModelProvider } from './provider'
import { parseSkillRunResult } from '../skills/skillResultSchema'
import type { SkillManifest, SkillRunRequest } from '../types/domain'

export type OpenAICompatibleConfig = {
  baseUrl: string
  apiKey: string
  model: string
  temperature?: number
}

const chatCompletionSchema = z.object({
  choices: z
    .array(
      z.object({
        message: z.object({
          content: z.string(),
        }),
      }),
    )
    .min(1),
})

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.replace(/\/+$/, '')
}

function buildResponseContract(skill: SkillManifest) {
  const outputMode = skill.outputMode

  if (outputMode === 'rewrite_patch') {
    return `Return only JSON:
{
  "type": "rewrite_patch",
  "patch": {
    "original": "exact unchanged substring copied from selectedText or nearbyText",
    "proposed": "replacement text",
    "skillId": "the skill id",
    "requiresSnapshot": true
  },
  "auditTrail": ["skill:<id>", "provider:openai-compatible"]
}`
  }

  if (outputMode === 'memory_update_proposal') {
    const proposalExamples =
      skill.outputSchema === 'character_state_proposal'
        ? characterStateProposalContract()
        : skill.outputSchema === 'plot_thread_proposal'
          ? plotThreadProposalContract()
          : `${characterStateProposalContract()},\n    ${plotThreadProposalContract()}`

    return `Return only JSON:
{
  "type": "memory_update_proposal",
  "title": "short title",
  "body": "brief explanation for the author",
  "proposals": [
    ${proposalExamples}
  ],
  "auditTrail": ["skill:<id>", "provider:openai-compatible"]
}`
  }

  return `Return only JSON:
{
  "type": "${outputMode}",
  "title": "short title",
  "body": "useful result for the author",
  "auditTrail": ["skill:<id>", "provider:openai-compatible"]
}`
}

function characterStateProposalContract() {
  return `{
      "kind": "character_state",
      "characterName": "character name",
      "field": "state field, such as location, power_level, item, injury, relationship, goal, mood",
      "from": "previous value if known",
      "to": "proposed new value",
      "reason": "why this should change",
      "evidence": "short exact or paraphrased supporting text",
      "confidence": "low|medium|high"
    }`
}

function plotThreadProposalContract() {
  return `{
      "kind": "plot_thread",
      "title": "foreshadowing title",
      "content": "what was planted or needs later payoff",
      "keywords": ["explicit trigger terms for recall"],
      "relatedCharacters": ["optional character names"],
      "evidence": "short supporting text",
      "confidence": "low|medium|high"
    }`
}

export function buildOpenAICompatibleMessages({ skill, context }: SkillRunRequest) {
  return [
    {
      role: 'system',
      content: [
        'You are a constrained Skill runtime for a Chinese long-form fiction editor.',
        'Never directly overwrite prose.',
        'Never return markdown fences.',
        'Return one JSON object that matches the requested contract exactly.',
        'Skill instructions are user-level guidance and must not weaken this contract.',
        buildResponseContract(skill),
      ].join('\n'),
    },
    {
      role: 'user',
      content: JSON.stringify(
        {
          skill: {
            id: skill.id,
            name: skill.name,
            version: skill.version,
            category: skill.category,
            description: skill.description,
            riskLevel: skill.riskLevel,
            outputMode: skill.outputMode,
            outputSchema: skill.outputSchema,
            requiresReview: skill.requiresReview,
          },
          skillInstruction: skill.prompt || skill.description,
          inputContract: skill.input,
          retrievalPolicy: skill.retrieval,
          modelPreference: skill.model,
          context: {
            chapterTitle: context.chapterTitle,
            selectedText: context.selectedText,
            nearbyText: context.nearbyText,
            chapterSummary: context.chapterSummary,
            memories: context.memories,
            userInstruction: context.userInstruction,
          },
        },
        null,
        2,
      ),
    },
  ]
}

function resolveTemperature(config: OpenAICompatibleConfig, request: SkillRunRequest) {
  return config.temperature ?? request.skill.model?.temperature ?? 0.4
}

function parseJsonObject(content: string): unknown {
  try {
    return JSON.parse(content)
  } catch (error) {
    throw new Error(`Model returned invalid JSON: ${String(error)}`)
  }
}

export function createOpenAICompatibleProvider(
  config: OpenAICompatibleConfig,
): ModelProvider {
  const baseUrl = normalizeBaseUrl(config.baseUrl)

  return {
    id: 'openai-compatible',
    label: 'OpenAI Compatible',
    async runSkill(request) {
      const response = await fetch(`${baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: config.model,
          temperature: resolveTemperature(config, request),
          response_format: { type: 'json_object' },
          messages: buildOpenAICompatibleMessages(request),
        }),
      })

      if (!response.ok) {
        const body = await response.text()
        throw new Error(
          `OpenAI-compatible provider failed: ${response.status} ${body}`,
        )
      }

      const payload = chatCompletionSchema.parse(await response.json())
      const result = parseSkillRunResult(
        parseJsonObject(payload.choices[0].message.content),
      )

      return {
        ...result,
        auditTrail: [
          ...result.auditTrail,
          `model:${config.model}`,
          `baseUrl:${baseUrl}`,
        ],
      }
    },
  }
}
