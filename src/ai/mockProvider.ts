import type { ModelProvider } from './provider'

function chooseOriginal(selectedText: string, nearbyText: string) {
  const trimmed = selectedText.trim()
  if (trimmed && nearbyText.includes(trimmed)) {
    return selectedText
  }

  return (
    nearbyText
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line && !line.startsWith('#')) || nearbyText.trim()
  )
}

export const mockProvider: ModelProvider = {
  id: 'mock.local',
  label: 'Local Mock Provider',
  async runSkill({ skill, context }) {
    const auditTrail = [
      `skill:${skill.id}`,
      `provider:mock.local`,
      ...context.memories.map((memory) => `${memory.layer}:${memory.source}`),
    ]

    if (skill.outputMode === 'rewrite_patch') {
      const original = chooseOriginal(context.selectedText, context.nearbyText)

      return {
        type: 'rewrite_patch',
        patch: {
          original,
          proposed: `${original}\n\n他没有退，也没有急着辩解，只把视线落在李长老手中的布囊上。那一瞬间，玄铁剑的震鸣像是替他说出了答案。`,
          skillId: skill.id,
          requiresSnapshot: true,
        },
        auditTrail,
      }
    }

    if (skill.outputMode === 'memory_update_proposal') {
      if (skill.id.includes('foreshadowing')) {
        return {
          type: 'memory_update_proposal',
          title: '伏笔记忆提议',
          body: '检测到玄铁剑裂纹仍未揭示来源，可作为未回收伏笔写入记忆，等待作者确认。',
          proposals: [
            {
              kind: 'plot_thread',
              title: '玄铁剑裂纹',
              content: '玄铁剑出现裂纹且来源尚未揭示，后续需要回收。',
              keywords: ['玄铁剑', '裂纹'],
              relatedCharacters: ['沈微', '李长老'],
              evidence: '玄铁剑的震鸣像是替他说出了答案。',
              confidence: 'medium',
            },
          ],
          auditTrail,
        }
      }

      return {
        type: 'memory_update_proposal',
        title: '人物状态提议',
        body: '检测到沈微在戒律堂前主动对抗李长老，可提议更新人物状态: 胆怯 -> 正面反抗。等待作者确认。',
        proposals: [
          {
            kind: 'character_state',
            characterName: '沈微',
            field: '心理状态',
            from: '胆怯',
            to: '正面反抗',
            reason: '本章中沈微没有退让，也没有急着辩解，开始正面对抗李长老的压迫。',
            evidence: '他没有退，也没有急着辩解。',
            confidence: 'medium',
          },
        ],
        auditTrail,
      }
    }

    if (skill.outputMode === 'chapter_summary') {
      const body = context.nearbyText
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith('#'))
        .join(' ')
      const sentences = body
        .split(/(?<=[。！？!?])\s*/)
        .map((sentence) => sentence.trim())
        .filter(Boolean)
      const opening = sentences[0] || '本章暂无可摘要正文。'
      const pivot =
        sentences.find((sentence) =>
          /(因为|所以|于是|随后|却|但|然而|发现|意识到|决定|结果|最终)/.test(
            sentence,
          ),
        ) || sentences[1]
      const ending = sentences.at(-1) || opening
      const summaryParts = [`起因: ${opening}`]

      if (pivot && pivot !== opening && pivot !== ending) {
        summaryParts.push(`推进: ${pivot}`)
      }
      if (ending !== opening) {
        summaryParts.push(`结果: ${ending}`)
      }

      const summary = summaryParts.join(' ')
      const keyEvents = [
        opening,
        pivot && pivot !== opening ? pivot : undefined,
        ending !== opening ? ending : undefined,
        context.memories.length > 0
          ? '摘要生成时参考了四层记忆上下文。'
          : '摘要生成时未检测到额外记忆上下文。',
      ].filter((event): event is string => Boolean(event))

      return {
        type: 'chapter_summary',
        summary,
        keyEvents,
        charactersInvolved: context.memories
          .filter((memory) => memory.layer === 'L0 事实')
          .map((memory) => memory.source)
          .slice(0, 5),
        auditTrail,
      }
    }

    if (skill.outputMode === 'export_artifact') {
      return {
        type: 'export_artifact',
        title: '导出产物',
        body: 'Mock provider 未生成真实导出文件。',
        auditTrail,
      }
    }

    return {
      type: 'report',
      title: '伏笔回收检查',
      body: '本章呼应了玄铁剑裂纹伏笔，但仍未正式揭示裂纹来源。建议继续保持未回收状态。',
      auditTrail,
    }
  },
}
