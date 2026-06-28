import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  buildOpenAICompatibleMessages,
  createOpenAICompatibleProvider,
} from './openAICompatibleProvider'
import type { SkillRunRequest } from '../types/domain'

const request: SkillRunRequest = {
  skill: {
    id: 'xuanhuan.dialogue_polish',
    name: '玄幻对白润色',
    version: '0.1.0',
    category: 'rewrite',
    description: '润色对白。',
    riskLevel: 'medium',
    outputMode: 'rewrite_patch',
    outputSchema: 'diff_patch',
    requiresReview: true,
    prompt: '保留人物压迫感，只润色可定位原文。',
    input: {
      required: ['selected_text', 'nearby_text'],
      optional: ['chapter_summary'],
    },
    retrieval: {
      includeRecentChapters: 1,
      includeCharacters: 'auto',
      includeWorldbuilding: 'auto',
    },
    model: {
      profile: 'balanced',
      temperature: 0.7,
    },
  },
  context: {
    selectedText: '沈微停在三步之外，没有行礼。',
    nearbyText: '沈微停在三步之外，没有行礼。',
    chapterTitle: '第十二章',
    memories: [],
  },
}

describe('OpenAI-compatible provider', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls the chat completions endpoint and parses structured skill output', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: JSON.stringify({
                  type: 'rewrite_patch',
                  patch: {
                    original: '沈微停在三步之外，没有行礼。',
                    proposed: '沈微停在三步之外，没有行礼，只抬眼望向檐下。',
                    skillId: 'xuanhuan.dialogue_polish',
                    requiresSnapshot: true,
                  },
                  auditTrail: ['skill:xuanhuan.dialogue_polish'],
                }),
              },
            },
          ],
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const provider = createOpenAICompatibleProvider({
      baseUrl: 'https://gateway.example.com/',
      apiKey: 'test-key',
      model: 'fiction-model',
    })

    const result = await provider.runSkill(request)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://gateway.example.com/v1/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-key',
        }),
      }),
    )
    const requestBody = JSON.parse(fetchMock.mock.calls[0][1].body as string)

    expect(requestBody.temperature).toBe(0.7)
    expect(requestBody.messages[0].content).toContain(
      'Skill instructions are user-level guidance',
    )
    expect(requestBody.messages[1].content).toContain(
      '保留人物压迫感，只润色可定位原文。',
    )
    expect(result.type).toBe('rewrite_patch')
    expect(result.auditTrail).toContain('model:fiction-model')
  })

  it('rejects invalid model JSON before it reaches the editor', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: 'not json' } }],
          }),
          { status: 200 },
        ),
      ),
    )

    const provider = createOpenAICompatibleProvider({
      baseUrl: 'https://gateway.example.com',
      apiKey: 'test-key',
      model: 'fiction-model',
    })

    await expect(provider.runSkill(request)).rejects.toThrow(
      'Model returned invalid JSON',
    )
  })

  it('keeps custom skill instructions in the user payload, not the system contract', () => {
    const messages = buildOpenAICompatibleMessages(request)

    expect(messages[0].content).not.toContain('保留人物压迫感')
    expect(messages[0].content).toContain('Return one JSON object')
    expect(messages[1].content).toContain('skillInstruction')
    expect(messages[1].content).toContain('retrievalPolicy')
  })

  it('includes plot-thread proposal fields in the memory update contract', () => {
    const messages = buildOpenAICompatibleMessages({
      ...request,
      skill: {
        ...request.skill,
        id: 'xuanhuan.foreshadowing_review',
        name: '伏笔回收检查',
        category: 'memory',
        outputMode: 'memory_update_proposal',
        outputSchema: 'plot_thread_proposal',
      },
    })

    expect(messages[0].content).toContain('"kind": "plot_thread"')
    expect(messages[0].content).not.toContain('"kind": "character_state"')
    expect(messages[0].content).toContain('"keywords"')
    expect(messages[0].content).toContain('"relatedCharacters"')
    expect(messages[1].content).toContain('"outputSchema": "plot_thread_proposal"')
  })

  it('includes both proposal shapes for mixed memory update contracts', () => {
    const messages = buildOpenAICompatibleMessages({
      ...request,
      skill: {
        ...request.skill,
        id: 'demo.foreshadowing_review',
        name: '本书伏笔体检',
        category: 'memory',
        outputMode: 'memory_update_proposal',
        outputSchema: 'mixed_memory_update',
      },
    })

    expect(messages[0].content).toContain('"kind": "character_state"')
    expect(messages[0].content).toContain('"kind": "plot_thread"')
  })
})
