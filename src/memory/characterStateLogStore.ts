import type { CharacterStateChangeProposal } from '../types/domain'

export type CharacterStateLog = CharacterStateChangeProposal & {
  id: string
  chapterId: string
  chapterTitle: string
  sourceSkillId: string
  confirmedAt: string
}

export type CharacterStateLogStore = {
  listLogs(): CharacterStateLog[]
  confirmProposal(input: {
    proposal: CharacterStateChangeProposal
    chapterId: string
    chapterTitle: string
    sourceSkillId: string
  }): CharacterStateLog
}

export function createCharacterStateLogStore(
  initialLogs: CharacterStateLog[] = [],
): CharacterStateLogStore {
  let logs = [...initialLogs]

  return {
    listLogs() {
      return [...logs]
    },
    confirmProposal(input) {
      const log: CharacterStateLog = {
        ...input.proposal,
        id: `${input.chapterId}:${input.proposal.characterName}:${input.proposal.field}:${logs.length + 1}`,
        chapterId: input.chapterId,
        chapterTitle: input.chapterTitle,
        sourceSkillId: input.sourceSkillId,
        confirmedAt: new Date().toISOString(),
      }

      logs = [...logs, log]
      return log
    },
  }
}
