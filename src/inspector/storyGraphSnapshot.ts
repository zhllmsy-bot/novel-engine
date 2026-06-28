import { z } from 'zod'

import type { StoryGraph, StoryGraphNodeKind } from './storyGraph'

export const storyGraphSnapshotVersion = 1
export const storyGraphSnapshotPath = '.novel/graph.json'

const nodeKindSchema = z.enum([
  'chapter',
  'memory',
  'codex',
  'plot_thread',
  'skill_run',
  'publish_job',
] satisfies StoryGraphNodeKind[])

export const storyGraphSnapshotSchema = z.object({
  version: z.literal(storyGraphSnapshotVersion),
  generatedAt: z.string().min(1),
  source: z.object({
    projectTitle: z.string().optional(),
    activeChapterId: z.string().optional(),
    activeChapterTitle: z.string().optional(),
  }),
  graph: z.object({
    nodes: z.array(
      z.object({
        id: z.string().min(1),
        kind: nodeKindSchema,
        label: z.string().min(1),
        detail: z.string(),
        layer: z.string().optional(),
        position: z.object({
          x: z.number(),
          y: z.number(),
        }),
      }),
    ),
    edges: z.array(
      z.object({
        id: z.string().min(1),
        from: z.string().min(1),
        to: z.string().min(1),
        label: z.string().min(1),
      }),
    ),
  }),
  viewState: z.object({
    selectedNodeId: z.string().optional(),
    collapsedNodeIds: z.array(z.string()).default([]),
  }),
})

export type StoryGraphSnapshot = z.infer<typeof storyGraphSnapshotSchema>

export type BuildStoryGraphSnapshotInput = {
  graph: StoryGraph
  generatedAt?: string
  projectTitle?: string
  activeChapterId?: string
  activeChapterTitle?: string
  selectedNodeId?: string
  collapsedNodeIds?: string[]
}

export function buildStoryGraphSnapshot(
  input: BuildStoryGraphSnapshotInput,
): StoryGraphSnapshot {
  return storyGraphSnapshotSchema.parse({
    version: storyGraphSnapshotVersion,
    generatedAt: input.generatedAt || new Date().toISOString(),
    source: {
      projectTitle: input.projectTitle,
      activeChapterId: input.activeChapterId,
      activeChapterTitle: input.activeChapterTitle,
    },
    graph: {
      nodes: input.graph.nodes.map((node) => ({
        id: node.id,
        kind: node.kind,
        label: node.label,
        detail: node.detail,
        layer: node.layer,
        position: {
          x: node.x,
          y: node.y,
        },
      })),
      edges: input.graph.edges,
    },
    viewState: {
      selectedNodeId: input.selectedNodeId,
      collapsedNodeIds: input.collapsedNodeIds || [],
    },
  })
}

export function parseStoryGraphSnapshot(value: unknown): StoryGraphSnapshot {
  return storyGraphSnapshotSchema.parse(value)
}

export function getStoryGraphSnapshotContentKey(
  snapshot: StoryGraphSnapshot,
): string {
  return JSON.stringify({
    version: snapshot.version,
    source: snapshot.source,
    graph: snapshot.graph,
    viewState: snapshot.viewState,
  })
}
