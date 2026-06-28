import { invoke } from '@tauri-apps/api/core'

export type ScannedChapter = {
  id: string
  title: string
  file_path: string
  content_hash: string
  word_count: number
}

export type ScannedMarkdownFile = {
  file_path: string
  content: string
}

export type ScannedSkillFile = {
  file_path: string
  content: string
}

export type ScannedPublisherAdapterFile = {
  file_path: string
  content: string
}

export type ScannedProviderAdapterFile = {
  file_path: string
  content: string
}

export type CachedChapterSummary = {
  chapter_id: string
  chapter_title: string
  source_hash: string
  summary: string
  key_events: string[]
  characters_involved: string[]
  is_edited: boolean
  updated_at: string
}

export type ChapterSummaryUpsert = {
  chapter_id: string
  source_hash: string
  summary: string
  key_events: string[]
  characters_involved: string[]
  is_edited: boolean
  updated_at: string
}

export type CachedVolumeSummary = {
  volume_id: string
  volume_title: string
  source_hash: string
  summary: string
  key_signals: string[]
  chapter_ids: string[]
  is_edited: boolean
  updated_at: string
}

export type VolumeSummaryUpsert = CachedVolumeSummary

export type CachedChapterVersion = {
  id: string
  chapter_id: string
  content_snapshot: string
  created_at: string
  source: string
  operation: string
  note?: string
  model_id?: string
  skill_id?: string
}

export type ChapterVersionInsert = {
  id: string
  chapter_id: string
  content_snapshot: string
  created_at: string
  source: string
  operation: string
  note?: string
  model_id?: string
  skill_id?: string
}

export type CachedCharacterStateLog = {
  id: string
  chapter_id: string
  chapter_title: string
  character_name: string
  field: string
  from_value?: string
  to_value: string
  reason: string
  evidence?: string
  confidence?: 'low' | 'medium' | 'high'
  source_skill_id: string
  confirmed_at: string
}

export type CharacterStateLogInsert = CachedCharacterStateLog

export type CachedPlotThread = {
  id: string
  title: string
  content: string
  planted_chapter_id: string
  planted_chapter_title: string
  keywords: string[]
  related_characters: string[]
  evidence?: string
  status: 'open' | 'resolved'
  resolved_chapter_id?: string
  resolved_chapter_title?: string
  resolution?: string
  confirmed: boolean
  source_skill_id: string
  confirmed_at: string
  updated_at: string
}

export type PlotThreadUpsert = CachedPlotThread

export function createNovelProject(path: string, title: string) {
  return invoke<void>('create_novel_project', { path, title })
}

export function initializeProjectCache(path: string) {
  return invoke<void>('initialize_project_cache', { path })
}

export function scanProjectChapters(path: string) {
  return invoke<ScannedChapter[]>('scan_project_chapters', { path })
}

export function readProjectManifestFile(path: string) {
  return invoke<string>('read_project_manifest_file', { path })
}

export function scanProjectCodex(path: string) {
  return invoke<ScannedMarkdownFile[]>('scan_project_codex', { path })
}

export function scanProjectSkills(path: string) {
  return invoke<ScannedSkillFile[]>('scan_project_skills', { path })
}

export function scanProjectPublisherAdapters(path: string) {
  return invoke<ScannedPublisherAdapterFile[]>(
    'scan_project_publisher_adapters',
    { path },
  )
}

export function scanProjectProviderAdapters(path: string) {
  return invoke<ScannedProviderAdapterFile[]>('scan_project_provider_adapters', {
    path,
  })
}

export function getProviderApiKey(providerId: string) {
  return invoke<string | null>('get_provider_api_key', {
    providerId,
  })
}

export function setProviderApiKey(providerId: string, apiKey: string) {
  return invoke<void>('set_provider_api_key', {
    providerId,
    apiKey,
  })
}

export function deleteProviderApiKey(providerId: string) {
  return invoke<void>('delete_provider_api_key', {
    providerId,
  })
}

export function readProjectChapter(path: string) {
  return invoke<string>('read_project_chapter', { path })
}

export function writeProjectChapter(path: string, content: string) {
  return invoke<void>('write_project_chapter', { path, content })
}

export function readProjectGraphSnapshot(path: string) {
  return invoke<string | null>('read_project_graph_snapshot', { path })
}

export function writeProjectGraphSnapshot(path: string, snapshot: string) {
  return invoke<void>('write_project_graph_snapshot', { path, snapshot })
}

export function listProjectChapterSummaries(path: string) {
  return invoke<CachedChapterSummary[]>('list_project_chapter_summaries', { path })
}

export function upsertProjectChapterSummary(
  path: string,
  summary: ChapterSummaryUpsert,
) {
  return invoke<void>('upsert_project_chapter_summary', { path, summary })
}

export function listProjectVolumeSummaries(path: string) {
  return invoke<CachedVolumeSummary[]>('list_project_volume_summaries', { path })
}

export function upsertProjectVolumeSummary(
  path: string,
  summary: VolumeSummaryUpsert,
) {
  return invoke<void>('upsert_project_volume_summary', { path, summary })
}

export function listProjectChapterVersions(path: string) {
  return invoke<CachedChapterVersion[]>('list_project_chapter_versions', { path })
}

export function insertProjectChapterVersion(
  path: string,
  version: ChapterVersionInsert,
) {
  return invoke<void>('insert_project_chapter_version', { path, version })
}

export function listProjectCharacterStateLogs(path: string) {
  return invoke<CachedCharacterStateLog[]>('list_project_character_state_logs', {
    path,
  })
}

export function insertProjectCharacterStateLog(
  path: string,
  log: CharacterStateLogInsert,
) {
  return invoke<void>('insert_project_character_state_log', { path, log })
}

export function listProjectPlotThreads(path: string) {
  return invoke<CachedPlotThread[]>('list_project_plot_threads', { path })
}

export function upsertProjectPlotThread(path: string, thread: PlotThreadUpsert) {
  return invoke<void>('upsert_project_plot_thread', { path, thread })
}
