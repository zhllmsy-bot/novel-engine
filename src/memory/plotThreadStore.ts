import type { ProjectChapter } from '../project/projectTypes'

export type PlotThreadStatus = 'open' | 'resolved'

export type PlotThreadProposal = {
  title: string
  content: string
  plantedChapterId: string
  keywords: string[]
  relatedCharacters?: string[]
  evidence?: string
}

export type PlotThread = PlotThreadProposal & {
  id: string
  plantedChapterTitle: string
  status: PlotThreadStatus
  resolvedChapterId?: string
  resolvedChapterTitle?: string
  resolution?: string
  confirmed: true
  sourceSkillId: string
  confirmedAt: string
  updatedAt: string
}

export type PlotThreadStore = {
  listThreads(): PlotThread[]
  confirmProposal(input: {
    proposal: PlotThreadProposal
    plantedChapter: ProjectChapter
    sourceSkillId: string
  }): PlotThread
  resolveThread(input: {
    threadId: string
    resolvedChapter: ProjectChapter
    resolution: string
  }): PlotThread | undefined
}

export function createPlotThreadStore(
  initialThreads: PlotThread[] = [],
): PlotThreadStore {
  let threads = [...initialThreads]

  return {
    listThreads() {
      return [...threads]
    },
    confirmProposal(input) {
      const now = new Date().toISOString()
      const thread: PlotThread = {
        ...input.proposal,
        id: `plot:${input.plantedChapter.id}:${slugify(input.proposal.title)}:${threads.length + 1}`,
        plantedChapterId: input.plantedChapter.id,
        plantedChapterTitle: input.plantedChapter.title,
        keywords: uniqueStrings([
          input.proposal.title,
          ...input.proposal.keywords,
        ]),
        status: 'open',
        confirmed: true,
        sourceSkillId: input.sourceSkillId,
        confirmedAt: now,
        updatedAt: now,
      }

      threads = [...threads, thread]
      return thread
    },
    resolveThread(input) {
      let resolvedThread: PlotThread | undefined

      threads = threads.map((thread) => {
        if (thread.id !== input.threadId) {
          return thread
        }

        resolvedThread = {
          ...thread,
          status: 'resolved',
          resolvedChapterId: input.resolvedChapter.id,
          resolvedChapterTitle: input.resolvedChapter.title,
          resolution: input.resolution,
          updatedAt: new Date().toISOString(),
        }

        return resolvedThread
      })

      return resolvedThread
    },
  }
}

function slugify(value: string) {
  return (
    value
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9_.\-\u4e00-\u9fa5]/g, '')
      .slice(0, 40) || 'thread'
  )
}

function uniqueStrings(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))]
}
