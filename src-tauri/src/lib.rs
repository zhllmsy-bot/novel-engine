mod project;
mod secrets;

use project::{
    create_project, init_cache, insert_chapter_version, insert_character_state_log,
    list_chapter_summaries, list_chapter_versions, list_chapters, list_character_state_logs,
    list_codex_files, list_plot_threads, list_provider_adapter_files,
    list_publisher_adapter_files, list_skill_files, list_volume_summaries, read_chapter_file,
    read_graph_snapshot, read_project_manifest, search_chapter_index, upsert_chapter_summary,
    write_chapter_file, write_graph_snapshot,
    ChapterInfo, ChapterSearchResult, ChapterSummaryInfo,
    ChapterSummaryPayload, ChapterVersionInfo, ChapterVersionPayload, CharacterStateLogInfo,
    CharacterStateLogPayload, MarkdownFileInfo, PlotThreadInfo, PlotThreadPayload,
    ProviderAdapterFileInfo, PublisherAdapterFileInfo, SkillFileInfo,
    VolumeSummaryInfo, VolumeSummaryPayload, upsert_plot_thread, upsert_volume_summary,
};
use secrets::{
    delete_provider_api_key as delete_provider_secret,
    get_provider_api_key as get_provider_secret,
    set_provider_api_key as set_provider_secret,
};
use serde::Serialize;

#[derive(Debug, Serialize)]
struct AppError {
    message: String,
}

impl From<project::ProjectError> for AppError {
    fn from(value: project::ProjectError) -> Self {
        Self {
            message: value.to_string(),
        }
    }
}

impl From<secrets::SecretError> for AppError {
    fn from(value: secrets::SecretError) -> Self {
        Self {
            message: value.to_string(),
        }
    }
}

type AppResult<T> = Result<T, AppError>;

#[tauri::command]
fn create_novel_project(path: String, title: String) -> AppResult<()> {
    create_project(path, title)?;
    Ok(())
}

#[tauri::command]
fn initialize_project_cache(path: String) -> AppResult<()> {
    init_cache(path)?;
    Ok(())
}

#[tauri::command]
fn scan_project_chapters(path: String) -> AppResult<Vec<ChapterInfo>> {
    Ok(list_chapters(path)?)
}

#[tauri::command]
fn search_project_chapter_index(
    path: String,
    query: String,
    limit: usize,
) -> AppResult<Vec<ChapterSearchResult>> {
    Ok(search_chapter_index(path, query, limit)?)
}

#[tauri::command]
fn read_project_manifest_file(path: String) -> AppResult<String> {
    Ok(read_project_manifest(path)?)
}

#[tauri::command]
fn scan_project_codex(path: String) -> AppResult<Vec<MarkdownFileInfo>> {
    Ok(list_codex_files(path)?)
}

#[tauri::command]
fn scan_project_skills(path: String) -> AppResult<Vec<SkillFileInfo>> {
    Ok(list_skill_files(path)?)
}

#[tauri::command]
fn scan_project_publisher_adapters(path: String) -> AppResult<Vec<PublisherAdapterFileInfo>> {
    Ok(list_publisher_adapter_files(path)?)
}

#[tauri::command]
fn scan_project_provider_adapters(path: String) -> AppResult<Vec<ProviderAdapterFileInfo>> {
    Ok(list_provider_adapter_files(path)?)
}

#[tauri::command]
fn read_project_chapter(path: String) -> AppResult<String> {
    Ok(read_chapter_file(path)?)
}

#[tauri::command]
fn write_project_chapter(path: String, content: String) -> AppResult<()> {
    write_chapter_file(path, content)?;
    Ok(())
}

#[tauri::command]
fn read_project_graph_snapshot(path: String) -> AppResult<Option<String>> {
    Ok(read_graph_snapshot(path)?)
}

#[tauri::command]
fn write_project_graph_snapshot(path: String, snapshot: String) -> AppResult<()> {
    write_graph_snapshot(path, snapshot)?;
    Ok(())
}

#[tauri::command]
fn list_project_chapter_summaries(path: String) -> AppResult<Vec<ChapterSummaryInfo>> {
    Ok(list_chapter_summaries(path)?)
}

#[tauri::command]
fn upsert_project_chapter_summary(
    path: String,
    summary: ChapterSummaryPayload,
) -> AppResult<()> {
    upsert_chapter_summary(path, summary)?;
    Ok(())
}

#[tauri::command]
fn list_project_volume_summaries(path: String) -> AppResult<Vec<VolumeSummaryInfo>> {
    Ok(list_volume_summaries(path)?)
}

#[tauri::command]
fn upsert_project_volume_summary(
    path: String,
    summary: VolumeSummaryPayload,
) -> AppResult<()> {
    upsert_volume_summary(path, summary)?;
    Ok(())
}

#[tauri::command]
fn list_project_chapter_versions(path: String) -> AppResult<Vec<ChapterVersionInfo>> {
    Ok(list_chapter_versions(path)?)
}

#[tauri::command]
fn insert_project_chapter_version(path: String, version: ChapterVersionPayload) -> AppResult<()> {
    insert_chapter_version(path, version)?;
    Ok(())
}

#[tauri::command]
fn list_project_character_state_logs(path: String) -> AppResult<Vec<CharacterStateLogInfo>> {
    Ok(list_character_state_logs(path)?)
}

#[tauri::command]
fn insert_project_character_state_log(
    path: String,
    log: CharacterStateLogPayload,
) -> AppResult<()> {
    insert_character_state_log(path, log)?;
    Ok(())
}

#[tauri::command]
fn list_project_plot_threads(path: String) -> AppResult<Vec<PlotThreadInfo>> {
    Ok(list_plot_threads(path)?)
}

#[tauri::command]
fn upsert_project_plot_thread(path: String, thread: PlotThreadPayload) -> AppResult<()> {
    upsert_plot_thread(path, thread)?;
    Ok(())
}

#[tauri::command]
fn get_provider_api_key(provider_id: String) -> AppResult<Option<String>> {
    Ok(get_provider_secret(&provider_id)?)
}

#[tauri::command]
fn set_provider_api_key(provider_id: String, api_key: String) -> AppResult<()> {
    set_provider_secret(&provider_id, &api_key)?;
    Ok(())
}

#[tauri::command]
fn delete_provider_api_key(provider_id: String) -> AppResult<()> {
    delete_provider_secret(&provider_id)?;
    Ok(())
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            create_novel_project,
            initialize_project_cache,
            scan_project_chapters,
            search_project_chapter_index,
            read_project_manifest_file,
            scan_project_codex,
            scan_project_skills,
            scan_project_publisher_adapters,
            scan_project_provider_adapters,
            read_project_chapter,
            write_project_chapter,
            read_project_graph_snapshot,
            write_project_graph_snapshot,
            list_project_chapter_summaries,
            upsert_project_chapter_summary,
            list_project_volume_summaries,
            upsert_project_volume_summary,
            list_project_chapter_versions,
            insert_project_chapter_version,
            list_project_character_state_logs,
            insert_project_character_state_log,
            list_project_plot_threads,
            upsert_project_plot_thread,
            get_provider_api_key,
            set_provider_api_key,
            delete_provider_api_key
        ])
        .run(tauri::generate_context!())
        .expect("failed to run Novel Engine");
}
