import type {
  CharacterStateChangeProposal,
  MemoryUpdateProposal,
  PlotThreadChangeProposal,
} from '@/types/domain'

export function isPlotThreadProposal(
  proposal: MemoryUpdateProposal,
): proposal is PlotThreadChangeProposal {
  return proposal.kind === 'plot_thread'
}

export function isCharacterStateProposal(
  proposal: MemoryUpdateProposal,
): proposal is CharacterStateChangeProposal {
  return proposal.kind === 'character_state'
}

export function stateProposalKey(proposal: CharacterStateChangeProposal) {
  return [
    'state',
    proposal.characterName,
    proposal.field,
    proposal.from || '',
    proposal.to,
  ].join(':')
}

export function plotThreadProposalKey(proposal: PlotThreadChangeProposal) {
  return [
    'plot',
    proposal.title,
    proposal.content,
    proposal.keywords.join(','),
  ].join(':')
}
