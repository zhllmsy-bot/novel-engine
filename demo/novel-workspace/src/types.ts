/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type CodexType = 'character' | 'item' | 'location' | 'faction';

export interface CodexEntry {
  id: string;
  name: string;
  type: CodexType;
  aliases: string[]; // Keywords used for L3 recall matching
  description: string;
  avatarColor?: string; // Elegant color accent for visual cards
  currentState?: string; // Markdown summary of current dynamic status
  dynamicState?: {
    location?: string;
    items?: string[];
    powerLevel?: string;
    status?: string;
    relationships?: { targetId: string; relation: string }[];
  };
}

export interface Chapter {
  id: string;
  title: string;
  content: string;
  order: number;
  storyTime?: string; // In-world timeline representation (e.g. "Day 1 Night")
  summary?: string; // L1 chapter summary
  keyEvents?: string[]; // Bullet-point plot beats
  charactersInvolved?: string[]; // IDs of Codex characters
  sceneDefIds?: string[]; // IDs of scene definitions
}

export interface StateLog {
  id: string;
  characterId: string;
  chapterId: string;
  key: string;
  value: string;
  timestamp: string;
}

export interface PlotThread {
  id: string;
  title: string;
  description: string;
  status: 'open' | 'resolved';
  plantedInChapterId: string;
  resolvedInChapterId?: string;
  keywords: string[];
}

// Memory Engine Types
export interface MemoryAuditEntry {
  id: string;
  source: string; // File name or identifier
  family: 'manuscript' | 'codex' | 'summary' | 'recall' | 'state' | 'thread';
  layer: 'L0' | 'L1' | 'L2' | 'L3';
  priority: number;
  content: string;
  originalSize: number;
  selectedSize: number;
  status: 'included' | 'truncated' | 'dropped';
  reason?: string;
}

export interface LayerSummary {
  layer: 'L0' | 'L1' | 'L2' | 'L3';
  size: number;
  targetShare: number;
  entryCount: number;
  truncatedCount: number;
  droppedCount: number;
}

export interface MemoryAudit {
  layerSummaries: Record<string, LayerSummary>;
  entries: MemoryAuditEntry[];
  sourceSummary: Record<string, number>; // Grouped tokens per family
}

export interface ProjectSettings {
  title: string;
  author: string;
  genre: string;
  description: string;
  fontFamily: 'serif' | 'sans' | 'mono';
  fontSize: number;
  lineHeight: number;
  columnWidth: number; // in pixels
  editorTheme?: 'parchment' | 'bamboo' | 'slate' | 'softcoal';
  typingSoundEnabled?: boolean;
}
