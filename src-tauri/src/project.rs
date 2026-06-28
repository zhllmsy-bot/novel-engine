use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;
use walkdir::WalkDir;

#[derive(Debug, Error)]
pub enum ProjectError {
    #[error("file system error: {0}")]
    Io(#[from] std::io::Error),
    #[error("database error: {0}")]
    Db(#[from] rusqlite::Error),
    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("invalid project path")]
    InvalidPath,
}

#[derive(Debug, Serialize)]
pub struct ChapterInfo {
    pub id: String,
    pub title: String,
    pub file_path: String,
    pub content_hash: String,
    pub word_count: usize,
}

#[derive(Debug, Serialize)]
pub struct SkillFileInfo {
    pub file_path: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct PublisherAdapterFileInfo {
    pub file_path: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct ProviderAdapterFileInfo {
    pub file_path: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct MarkdownFileInfo {
    pub file_path: String,
    pub content: String,
}

#[derive(Debug, Serialize)]
pub struct ChapterSummaryInfo {
    pub chapter_id: String,
    pub chapter_title: String,
    pub source_hash: String,
    pub summary: String,
    pub key_events: Vec<String>,
    pub characters_involved: Vec<String>,
    pub is_edited: bool,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct ChapterSummaryPayload {
    pub chapter_id: String,
    pub source_hash: String,
    pub summary: String,
    pub key_events: Vec<String>,
    pub characters_involved: Vec<String>,
    pub is_edited: bool,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct VolumeSummaryInfo {
    pub volume_id: String,
    pub volume_title: String,
    pub source_hash: String,
    pub summary: String,
    pub key_signals: Vec<String>,
    pub chapter_ids: Vec<String>,
    pub is_edited: bool,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct VolumeSummaryPayload {
    pub volume_id: String,
    pub volume_title: String,
    pub source_hash: String,
    pub summary: String,
    pub key_signals: Vec<String>,
    pub chapter_ids: Vec<String>,
    pub is_edited: bool,
    pub updated_at: String,
}

#[derive(Debug, Serialize)]
pub struct ChapterVersionInfo {
    pub id: String,
    pub chapter_id: String,
    pub content_snapshot: String,
    pub created_at: String,
    pub source: String,
    pub operation: String,
    pub note: Option<String>,
    pub model_id: Option<String>,
    pub skill_id: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ChapterVersionPayload {
    pub id: String,
    pub chapter_id: String,
    pub content_snapshot: String,
    pub created_at: String,
    pub source: String,
    pub operation: String,
    pub note: Option<String>,
    pub model_id: Option<String>,
    pub skill_id: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct CharacterStateLogInfo {
    pub id: String,
    pub chapter_id: String,
    pub chapter_title: String,
    pub character_name: String,
    pub field: String,
    pub from_value: Option<String>,
    pub to_value: String,
    pub reason: String,
    pub evidence: Option<String>,
    pub confidence: Option<String>,
    pub source_skill_id: String,
    pub confirmed_at: String,
}

#[derive(Debug, Deserialize)]
pub struct CharacterStateLogPayload {
    pub id: String,
    pub chapter_id: String,
    pub chapter_title: String,
    pub character_name: String,
    pub field: String,
    pub from_value: Option<String>,
    pub to_value: String,
    pub reason: String,
    pub evidence: Option<String>,
    pub confidence: Option<String>,
    pub source_skill_id: String,
    pub confirmed_at: String,
}

#[derive(Debug, Serialize)]
pub struct PlotThreadInfo {
    pub id: String,
    pub title: String,
    pub content: String,
    pub planted_chapter_id: String,
    pub planted_chapter_title: String,
    pub keywords: Vec<String>,
    pub related_characters: Vec<String>,
    pub evidence: Option<String>,
    pub status: String,
    pub resolved_chapter_id: Option<String>,
    pub resolved_chapter_title: Option<String>,
    pub resolution: Option<String>,
    pub confirmed: bool,
    pub source_skill_id: String,
    pub confirmed_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
pub struct PlotThreadPayload {
    pub id: String,
    pub title: String,
    pub content: String,
    pub planted_chapter_id: String,
    pub planted_chapter_title: String,
    pub keywords: Vec<String>,
    pub related_characters: Vec<String>,
    pub evidence: Option<String>,
    pub status: String,
    pub resolved_chapter_id: Option<String>,
    pub resolved_chapter_title: Option<String>,
    pub resolution: Option<String>,
    pub confirmed: bool,
    pub source_skill_id: String,
    pub confirmed_at: String,
    pub updated_at: String,
}

pub fn create_project(path: String, title: String) -> Result<(), ProjectError> {
    let root = normalize_project_path(path)?;

    fs::create_dir_all(root.join("manuscript").join("volume-001"))?;
    fs::create_dir_all(root.join("codex").join("characters"))?;
    fs::create_dir_all(root.join("codex").join("locations"))?;
    fs::create_dir_all(root.join("codex").join("items"))?;
    fs::create_dir_all(root.join("codex").join("organizations"))?;
    fs::create_dir_all(root.join("meta"))?;
    fs::create_dir_all(root.join("skills").join("local"))?;
    fs::create_dir_all(root.join(".novel"))?;

    let project_json = serde_json::json!({
        "schema_version": 1,
        "title": title,
        "created_at": Utc::now().to_rfc3339(),
        "source_of_truth": "markdown",
        "chapters": []
    });
    fs::write(
        root.join("meta").join("project.json"),
        serde_json::to_string_pretty(&project_json).expect("project json should serialize"),
    )?;

    let first_chapter = root
        .join("manuscript")
        .join("volume-001")
        .join("chapter-001.md");
    if !first_chapter.exists() {
        fs::write(first_chapter, "# 第001章\n\n从这里开始写作。\n")?;
    }

    init_cache(root.to_string_lossy().to_string())?;
    Ok(())
}

pub fn init_cache(path: String) -> Result<(), ProjectError> {
    open_cache(path)?;
    Ok(())
}

pub fn list_chapters(path: String) -> Result<Vec<ChapterInfo>, ProjectError> {
    let root = normalize_project_path(path)?;
    let mut chapters = Vec::new();

    for entry in WalkDir::new(root.join("manuscript"))
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file())
    {
        if entry.path().extension().and_then(|value| value.to_str()) != Some("md") {
            continue;
        }

        let content = fs::read_to_string(entry.path())?;
        chapters.push(chapter_from_file(entry.path(), &content));
    }

    chapters.sort_by(|a, b| a.file_path.cmp(&b.file_path));
    Ok(chapters)
}

pub fn list_skill_files(path: String) -> Result<Vec<SkillFileInfo>, ProjectError> {
    let root = normalize_project_path(path)?;
    let skills_root = root.join("skills");
    let mut skill_files = Vec::new();

    if !skills_root.exists() {
        return Ok(skill_files);
    }

    for entry in WalkDir::new(skills_root)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file())
    {
        if !is_skill_manifest_file(entry.path()) {
            continue;
        }

        let relative_path = entry.path().strip_prefix(&root).unwrap_or(entry.path());
        skill_files.push(SkillFileInfo {
            file_path: relative_path.to_string_lossy().to_string(),
            content: fs::read_to_string(entry.path())?,
        });
    }

    skill_files.sort_by(|a, b| a.file_path.cmp(&b.file_path));
    Ok(skill_files)
}

pub fn list_publisher_adapter_files(
    path: String,
) -> Result<Vec<PublisherAdapterFileInfo>, ProjectError> {
    let root = normalize_project_path(path)?;
    let adapters_root = root.join("publisher").join("adapters");
    let mut adapter_files = Vec::new();

    if !adapters_root.exists() {
        return Ok(adapter_files);
    }

    for entry in WalkDir::new(adapters_root)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file())
    {
        if entry.path().file_name().and_then(|value| value.to_str())
            != Some("publisher.adapter.json")
        {
            continue;
        }

        let relative_path = entry.path().strip_prefix(&root).unwrap_or(entry.path());
        adapter_files.push(PublisherAdapterFileInfo {
            file_path: relative_path.to_string_lossy().to_string(),
            content: fs::read_to_string(entry.path())?,
        });
    }

    adapter_files.sort_by(|a, b| a.file_path.cmp(&b.file_path));
    Ok(adapter_files)
}

pub fn list_provider_adapter_files(
    path: String,
) -> Result<Vec<ProviderAdapterFileInfo>, ProjectError> {
    let root = normalize_project_path(path)?;
    let adapters_root = root.join("providers");
    let mut adapter_files = Vec::new();

    if !adapters_root.exists() {
        return Ok(adapter_files);
    }

    for entry in WalkDir::new(adapters_root)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file())
    {
        if entry.path().file_name().and_then(|value| value.to_str())
            != Some("provider.adapter.json")
        {
            continue;
        }

        let relative_path = entry.path().strip_prefix(&root).unwrap_or(entry.path());
        adapter_files.push(ProviderAdapterFileInfo {
            file_path: relative_path.to_string_lossy().to_string(),
            content: fs::read_to_string(entry.path())?,
        });
    }

    adapter_files.sort_by(|a, b| a.file_path.cmp(&b.file_path));
    Ok(adapter_files)
}

pub fn read_project_manifest(path: String) -> Result<String, ProjectError> {
    let root = normalize_project_path(path)?;
    Ok(fs::read_to_string(root.join("meta").join("project.json"))?)
}

pub fn list_codex_files(path: String) -> Result<Vec<MarkdownFileInfo>, ProjectError> {
    let root = normalize_project_path(path)?;
    let codex_root = root.join("codex");
    let mut codex_files = Vec::new();

    if !codex_root.exists() {
        return Ok(codex_files);
    }

    for entry in WalkDir::new(codex_root)
        .into_iter()
        .filter_map(Result::ok)
        .filter(|entry| entry.file_type().is_file())
    {
        if entry.path().extension().and_then(|value| value.to_str()) != Some("md") {
            continue;
        }

        let relative_path = entry.path().strip_prefix(&root).unwrap_or(entry.path());
        codex_files.push(MarkdownFileInfo {
            file_path: relative_path.to_string_lossy().to_string(),
            content: fs::read_to_string(entry.path())?,
        });
    }

    codex_files.sort_by(|a, b| a.file_path.cmp(&b.file_path));
    Ok(codex_files)
}

pub fn read_chapter_file(path: String) -> Result<String, ProjectError> {
    let file_path = normalize_project_path(path)?;
    Ok(fs::read_to_string(file_path)?)
}

pub fn write_chapter_file(path: String, content: String) -> Result<(), ProjectError> {
    let file_path = normalize_project_path(path)?;
    fs::write(file_path, content)?;
    Ok(())
}

pub fn read_graph_snapshot(path: String) -> Result<Option<String>, ProjectError> {
    let root = normalize_project_path(path)?;
    let graph_path = root.join(".novel").join("graph.json");

    if !graph_path.exists() {
        return Ok(None);
    }

    Ok(Some(fs::read_to_string(graph_path)?))
}

pub fn write_graph_snapshot(path: String, snapshot: String) -> Result<(), ProjectError> {
    let root = normalize_project_path(path)?;
    fs::create_dir_all(root.join(".novel"))?;
    fs::write(root.join(".novel").join("graph.json"), snapshot)?;
    Ok(())
}

pub fn list_chapter_summaries(path: String) -> Result<Vec<ChapterSummaryInfo>, ProjectError> {
    let (_root, conn) = open_cache(path)?;
    let mut stmt = conn.prepare(
        r#"
        SELECT
          cs.chapter_id,
          COALESCE(ch.title, cs.chapter_id) AS chapter_title,
          cs.source_hash,
          cs.summary,
          cs.key_events,
          cs.characters_involved,
          cs.is_edited,
          cs.updated_at
        FROM chapter_summary cs
        LEFT JOIN chapter ch ON ch.id = cs.chapter_id
        ORDER BY ch.order_idx, cs.chapter_id
        "#,
    )?;
    let summaries = stmt.query_map([], |row| {
        let key_events_json: String = row.get(4)?;
        let characters_json: String = row.get(5)?;
        let is_edited: i64 = row.get(6)?;

        Ok(ChapterSummaryInfo {
            chapter_id: row.get(0)?,
            chapter_title: row.get(1)?,
            source_hash: row.get(2)?,
            summary: row.get(3)?,
            key_events: parse_json_list(&key_events_json),
            characters_involved: parse_json_list(&characters_json),
            is_edited: is_edited != 0,
            updated_at: row.get(7)?,
        })
    })?;

    let mut result = Vec::new();
    for summary in summaries {
        result.push(summary?);
    }
    Ok(result)
}

pub fn upsert_chapter_summary(
    path: String,
    summary: ChapterSummaryPayload,
) -> Result<(), ProjectError> {
    let (_root, conn) = open_cache(path)?;
    let existing_is_edited = conn
        .query_row(
            "SELECT is_edited FROM chapter_summary WHERE chapter_id = ?1",
            params![&summary.chapter_id],
            |row| row.get::<_, i64>(0),
        )
        .optional()?;

    if existing_is_edited == Some(1) && !summary.is_edited {
        return Ok(());
    }

    let generated_at = Utc::now().to_rfc3339();
    let updated_at = if summary.updated_at.trim().is_empty() {
        generated_at.clone()
    } else {
        summary.updated_at
    };
    let key_events = serde_json::to_string(&summary.key_events)?;
    let characters_involved = serde_json::to_string(&summary.characters_involved)?;
    let is_edited = if summary.is_edited { 1 } else { 0 };

    conn.execute(
        r#"
        INSERT INTO chapter_summary (
          chapter_id, source_hash, summary, key_events,
          characters_involved, is_edited, generated_by_model,
          generated_at, updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'local', ?7, ?8)
        ON CONFLICT(chapter_id) DO UPDATE SET
          source_hash = excluded.source_hash,
          summary = excluded.summary,
          key_events = excluded.key_events,
          characters_involved = excluded.characters_involved,
          is_edited = excluded.is_edited,
          generated_by_model = excluded.generated_by_model,
          updated_at = excluded.updated_at
        "#,
        params![
            summary.chapter_id,
            summary.source_hash,
            summary.summary,
            key_events,
            characters_involved,
            is_edited,
            generated_at,
            updated_at
        ],
    )?;
    Ok(())
}

pub fn list_volume_summaries(path: String) -> Result<Vec<VolumeSummaryInfo>, ProjectError> {
    let (_root, conn) = open_cache(path)?;
    let mut stmt = conn.prepare(
        r#"
        SELECT
          volume_id,
          volume_title,
          source_hash,
          summary,
          key_signals,
          chapter_ids,
          is_edited,
          updated_at
        FROM volume_summary
        ORDER BY volume_id ASC
        "#,
    )?;
    let summaries = stmt.query_map([], |row| {
        let key_signals_json: String = row.get(4)?;
        let chapter_ids_json: String = row.get(5)?;
        let is_edited: i64 = row.get(6)?;

        Ok(VolumeSummaryInfo {
            volume_id: row.get(0)?,
            volume_title: row.get(1)?,
            source_hash: row.get(2)?,
            summary: row.get(3)?,
            key_signals: parse_json_list(&key_signals_json),
            chapter_ids: parse_json_list(&chapter_ids_json),
            is_edited: is_edited != 0,
            updated_at: row.get(7)?,
        })
    })?;

    let mut result = Vec::new();
    for summary in summaries {
        result.push(summary?);
    }
    Ok(result)
}

pub fn upsert_volume_summary(
    path: String,
    summary: VolumeSummaryPayload,
) -> Result<(), ProjectError> {
    let (_root, conn) = open_cache(path)?;
    let existing_is_edited = conn
        .query_row(
            "SELECT is_edited FROM volume_summary WHERE volume_id = ?1",
            params![&summary.volume_id],
            |row| row.get::<_, i64>(0),
        )
        .optional()?;

    if existing_is_edited == Some(1) && !summary.is_edited {
        return Ok(());
    }

    let generated_at = Utc::now().to_rfc3339();
    let updated_at = if summary.updated_at.trim().is_empty() {
        generated_at.clone()
    } else {
        summary.updated_at
    };
    let key_signals = serde_json::to_string(&summary.key_signals)?;
    let chapter_ids = serde_json::to_string(&summary.chapter_ids)?;
    let is_edited = if summary.is_edited { 1 } else { 0 };

    conn.execute(
        r#"
        INSERT INTO volume_summary (
          volume_id, volume_title, source_hash, summary,
          key_signals, chapter_ids, is_edited, generated_by_model,
          generated_at, updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 'local', ?8, ?9)
        ON CONFLICT(volume_id) DO UPDATE SET
          volume_title = excluded.volume_title,
          source_hash = excluded.source_hash,
          summary = excluded.summary,
          key_signals = excluded.key_signals,
          chapter_ids = excluded.chapter_ids,
          is_edited = excluded.is_edited,
          generated_by_model = excluded.generated_by_model,
          updated_at = excluded.updated_at
        "#,
        params![
            summary.volume_id,
            summary.volume_title,
            summary.source_hash,
            summary.summary,
            key_signals,
            chapter_ids,
            is_edited,
            generated_at,
            updated_at,
        ],
    )?;
    Ok(())
}

pub fn list_chapter_versions(path: String) -> Result<Vec<ChapterVersionInfo>, ProjectError> {
    let (_root, conn) = open_cache(path)?;
    let mut stmt = conn.prepare(
        r#"
        SELECT
          id,
          chapter_id,
          content_snapshot,
          created_at,
          source,
          operation,
          note,
          model_id,
          skill_id
        FROM chapter_versions
        ORDER BY created_at DESC, id DESC
        "#,
    )?;
    let versions = stmt.query_map([], |row| {
        Ok(ChapterVersionInfo {
            id: row.get(0)?,
            chapter_id: row.get(1)?,
            content_snapshot: row.get(2)?,
            created_at: row.get(3)?,
            source: row.get(4)?,
            operation: row.get(5)?,
            note: row.get(6)?,
            model_id: row.get(7)?,
            skill_id: row.get(8)?,
        })
    })?;

    let mut result = Vec::new();
    for version in versions {
        result.push(version?);
    }
    Ok(result)
}

pub fn insert_chapter_version(
    path: String,
    version: ChapterVersionPayload,
) -> Result<(), ProjectError> {
    let (_root, conn) = open_cache(path)?;
    conn.execute(
        r#"
        INSERT INTO chapter_versions (
          id,
          chapter_id,
          content_snapshot,
          created_at,
          source,
          operation,
          note,
          model_id,
          skill_id,
          parent_version_id
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, NULL)
        "#,
        params![
            version.id,
            version.chapter_id,
            version.content_snapshot,
            version.created_at,
            version.source,
            version.operation,
            version.note,
            version.model_id,
            version.skill_id,
        ],
    )?;
    Ok(())
}

pub fn list_character_state_logs(path: String) -> Result<Vec<CharacterStateLogInfo>, ProjectError> {
    let (_root, conn) = open_cache(path)?;
    let mut stmt = conn.prepare(
        r#"
        SELECT
          id,
          chapter_id,
          chapter_title,
          character_name,
          field,
          from_value,
          to_value,
          reason,
          evidence,
          confidence,
          source_skill_id,
          confirmed_at
        FROM character_state_log
        ORDER BY confirmed_at ASC, id ASC
        "#,
    )?;
    let logs = stmt.query_map([], |row| {
        Ok(CharacterStateLogInfo {
            id: row.get(0)?,
            chapter_id: row.get(1)?,
            chapter_title: row.get(2)?,
            character_name: row.get(3)?,
            field: row.get(4)?,
            from_value: row.get(5)?,
            to_value: row.get(6)?,
            reason: row.get(7)?,
            evidence: row.get(8)?,
            confidence: row.get(9)?,
            source_skill_id: row.get(10)?,
            confirmed_at: row.get(11)?,
        })
    })?;

    let mut result = Vec::new();
    for log in logs {
        result.push(log?);
    }
    Ok(result)
}

pub fn insert_character_state_log(
    path: String,
    log: CharacterStateLogPayload,
) -> Result<(), ProjectError> {
    let (_root, conn) = open_cache(path)?;
    conn.execute(
        r#"
        INSERT INTO character_state_log (
          id,
          chapter_id,
          chapter_title,
          character_name,
          field,
          from_value,
          to_value,
          reason,
          evidence,
          confidence,
          source_skill_id,
          confirmed_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)
        ON CONFLICT(id) DO UPDATE SET
          chapter_id = excluded.chapter_id,
          chapter_title = excluded.chapter_title,
          character_name = excluded.character_name,
          field = excluded.field,
          from_value = excluded.from_value,
          to_value = excluded.to_value,
          reason = excluded.reason,
          evidence = excluded.evidence,
          confidence = excluded.confidence,
          source_skill_id = excluded.source_skill_id,
          confirmed_at = excluded.confirmed_at
        "#,
        params![
            log.id,
            log.chapter_id,
            log.chapter_title,
            log.character_name,
            log.field,
            log.from_value,
            log.to_value,
            log.reason,
            log.evidence,
            log.confidence,
            log.source_skill_id,
            log.confirmed_at,
        ],
    )?;
    Ok(())
}

pub fn list_plot_threads(path: String) -> Result<Vec<PlotThreadInfo>, ProjectError> {
    let (_root, conn) = open_cache(path)?;
    let mut stmt = conn.prepare(
        r#"
        SELECT
          id,
          title,
          content,
          planted_chapter_id,
          planted_chapter_title,
          keywords,
          related_characters,
          evidence,
          status,
          resolved_chapter_id,
          resolved_chapter_title,
          resolution,
          confirmed,
          source_skill_id,
          confirmed_at,
          updated_at
        FROM plot_thread
        ORDER BY confirmed_at ASC, id ASC
        "#,
    )?;
    let threads = stmt.query_map([], |row| {
        let keywords_json: String = row.get(5)?;
        let related_characters_json: String = row.get(6)?;
        let confirmed: i64 = row.get(12)?;

        Ok(PlotThreadInfo {
            id: row.get(0)?,
            title: row.get(1)?,
            content: row.get(2)?,
            planted_chapter_id: row.get(3)?,
            planted_chapter_title: row.get(4)?,
            keywords: parse_json_list(&keywords_json),
            related_characters: parse_json_list(&related_characters_json),
            evidence: row.get(7)?,
            status: row.get(8)?,
            resolved_chapter_id: row.get(9)?,
            resolved_chapter_title: row.get(10)?,
            resolution: row.get(11)?,
            confirmed: confirmed != 0,
            source_skill_id: row.get(13)?,
            confirmed_at: row.get(14)?,
            updated_at: row.get(15)?,
        })
    })?;

    let mut result = Vec::new();
    for thread in threads {
        result.push(thread?);
    }
    Ok(result)
}

pub fn upsert_plot_thread(path: String, thread: PlotThreadPayload) -> Result<(), ProjectError> {
    let (_root, conn) = open_cache(path)?;
    let keywords = serde_json::to_string(&thread.keywords)?;
    let related_characters = serde_json::to_string(&thread.related_characters)?;
    let confirmed = if thread.confirmed { 1 } else { 0 };

    conn.execute(
        r#"
        INSERT INTO plot_thread (
          id,
          title,
          content,
          planted_chapter_id,
          planted_chapter_title,
          keywords,
          related_characters,
          evidence,
          status,
          resolved_chapter_id,
          resolved_chapter_title,
          resolution,
          confirmed,
          source_skill_id,
          confirmed_at,
          updated_at
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          content = excluded.content,
          planted_chapter_id = excluded.planted_chapter_id,
          planted_chapter_title = excluded.planted_chapter_title,
          keywords = excluded.keywords,
          related_characters = excluded.related_characters,
          evidence = excluded.evidence,
          status = excluded.status,
          resolved_chapter_id = excluded.resolved_chapter_id,
          resolved_chapter_title = excluded.resolved_chapter_title,
          resolution = excluded.resolution,
          confirmed = excluded.confirmed,
          source_skill_id = excluded.source_skill_id,
          confirmed_at = excluded.confirmed_at,
          updated_at = excluded.updated_at
        "#,
        params![
            thread.id,
            thread.title,
            thread.content,
            thread.planted_chapter_id,
            thread.planted_chapter_title,
            keywords,
            related_characters,
            thread.evidence,
            thread.status,
            thread.resolved_chapter_id,
            thread.resolved_chapter_title,
            thread.resolution,
            confirmed,
            thread.source_skill_id,
            thread.confirmed_at,
            thread.updated_at,
        ],
    )?;
    Ok(())
}

fn normalize_project_path(path: String) -> Result<PathBuf, ProjectError> {
    let root = PathBuf::from(path);
    if root.as_os_str().is_empty() {
        return Err(ProjectError::InvalidPath);
    }
    Ok(root)
}

fn open_cache(path: String) -> Result<(PathBuf, Connection), ProjectError> {
    let root = normalize_project_path(path)?;
    fs::create_dir_all(root.join(".novel"))?;
    let conn = Connection::open(root.join(".novel").join("cache.db"))?;
    apply_schema(&conn)?;
    upsert_scanned_chapters(&conn, &root)?;
    Ok((root, conn))
}

fn apply_schema(conn: &Connection) -> Result<(), ProjectError> {
    conn.execute_batch(
        r#"
        PRAGMA foreign_keys = ON;

        CREATE TABLE IF NOT EXISTS chapter (
          id TEXT PRIMARY KEY,
          volume_id TEXT,
          order_idx INTEGER NOT NULL,
          title TEXT NOT NULL,
          file_path TEXT NOT NULL,
          content TEXT NOT NULL DEFAULT '',
          content_hash TEXT NOT NULL DEFAULT '',
          word_count INTEGER NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'draft',
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_chapter_order
        ON chapter (volume_id, order_idx);

        CREATE TABLE IF NOT EXISTS chapter_summary (
          chapter_id TEXT PRIMARY KEY,
          source_hash TEXT NOT NULL,
          summary TEXT NOT NULL,
          key_events TEXT NOT NULL DEFAULT '[]',
          characters_involved TEXT NOT NULL DEFAULT '[]',
          is_edited INTEGER NOT NULL DEFAULT 0,
          generated_by_model TEXT,
          generated_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (chapter_id) REFERENCES chapter(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS volume_summary (
          volume_id TEXT PRIMARY KEY,
          volume_title TEXT NOT NULL,
          source_hash TEXT NOT NULL,
          summary TEXT NOT NULL,
          key_signals TEXT NOT NULL DEFAULT '[]',
          chapter_ids TEXT NOT NULL DEFAULT '[]',
          is_edited INTEGER NOT NULL DEFAULT 0,
          generated_by_model TEXT,
          generated_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_volume_summary_updated
        ON volume_summary (updated_at DESC);

        CREATE TABLE IF NOT EXISTS chapter_versions (
          id TEXT PRIMARY KEY,
          chapter_id TEXT NOT NULL,
          content_snapshot TEXT NOT NULL,
          created_at TEXT NOT NULL,
          source TEXT NOT NULL,
          operation TEXT NOT NULL,
          note TEXT,
          model_id TEXT,
          skill_id TEXT,
          parent_version_id TEXT,
          FOREIGN KEY (chapter_id) REFERENCES chapter(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_chapter_versions_chapter_time
        ON chapter_versions (chapter_id, created_at DESC);

        CREATE TABLE IF NOT EXISTS character_state_log (
          id TEXT PRIMARY KEY,
          chapter_id TEXT NOT NULL,
          chapter_title TEXT NOT NULL,
          character_name TEXT NOT NULL,
          field TEXT NOT NULL,
          from_value TEXT,
          to_value TEXT NOT NULL,
          reason TEXT NOT NULL,
          evidence TEXT,
          confidence TEXT,
          source_skill_id TEXT NOT NULL,
          confirmed_at TEXT NOT NULL,
          FOREIGN KEY (chapter_id) REFERENCES chapter(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_character_state_log_character_time
        ON character_state_log (character_name, confirmed_at);

        CREATE INDEX IF NOT EXISTS idx_character_state_log_chapter
        ON character_state_log (chapter_id);

        CREATE TABLE IF NOT EXISTS plot_thread (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          planted_chapter_id TEXT NOT NULL,
          planted_chapter_title TEXT NOT NULL,
          keywords TEXT NOT NULL DEFAULT '[]',
          related_characters TEXT NOT NULL DEFAULT '[]',
          evidence TEXT,
          status TEXT NOT NULL DEFAULT 'open',
          resolved_chapter_id TEXT,
          resolved_chapter_title TEXT,
          resolution TEXT,
          confirmed INTEGER NOT NULL DEFAULT 1,
          source_skill_id TEXT NOT NULL,
          confirmed_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          FOREIGN KEY (planted_chapter_id) REFERENCES chapter(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS idx_plot_thread_status
        ON plot_thread (status, confirmed_at);

        CREATE INDEX IF NOT EXISTS idx_plot_thread_planted_chapter
        ON plot_thread (planted_chapter_id);

        CREATE TABLE IF NOT EXISTS memory_job (
          id TEXT PRIMARY KEY,
          job_type TEXT NOT NULL,
          target_type TEXT NOT NULL,
          target_id TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'queued',
          error TEXT,
          attempts INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          started_at TEXT,
          finished_at TEXT
        );

        CREATE TABLE IF NOT EXISTS skill_manifest (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          version TEXT NOT NULL,
          file_path TEXT NOT NULL,
          risk_level TEXT NOT NULL,
          output_mode TEXT NOT NULL,
          enabled INTEGER NOT NULL DEFAULT 1,
          loaded_at TEXT NOT NULL
        );

        CREATE VIRTUAL TABLE IF NOT EXISTS chapter_fts
        USING fts5(title, content, summary, content='', tokenize='unicode61');
        "#,
    )?;
    Ok(())
}

fn upsert_scanned_chapters(conn: &Connection, root: &Path) -> Result<(), ProjectError> {
    let chapters = list_chapters(root.to_string_lossy().to_string())?;
    let now = Utc::now().to_rfc3339();

    for (index, chapter) in chapters.iter().enumerate() {
        let content = fs::read_to_string(&chapter.file_path)?;
        conn.execute(
            r#"
            INSERT INTO chapter (
              id, volume_id, order_idx, title, file_path, content,
              content_hash, word_count, status, created_at, updated_at
            )
            VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, 'draft', ?9, ?10)
            ON CONFLICT(id) DO UPDATE SET
              order_idx = excluded.order_idx,
              title = excluded.title,
              file_path = excluded.file_path,
              content = excluded.content,
              content_hash = excluded.content_hash,
              word_count = excluded.word_count,
              updated_at = excluded.updated_at
            "#,
            (
                &chapter.id,
                "volume-001",
                index as i64,
                &chapter.title,
                &chapter.file_path,
                content,
                &chapter.content_hash,
                chapter.word_count as i64,
                &now,
                &now,
            ),
        )?;
    }

    Ok(())
}

fn chapter_from_file(path: &Path, content: &str) -> ChapterInfo {
    let title = content
        .lines()
        .find(|line| !line.trim().is_empty())
        .map(|line| line.trim().trim_start_matches('#').trim().to_string())
        .filter(|line| !line.is_empty())
        .unwrap_or_else(|| {
            path.file_stem()
                .and_then(|value| value.to_str())
                .unwrap_or("Untitled")
                .to_string()
        });
    let id = path
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("chapter")
        .to_string();

    ChapterInfo {
        id,
        title,
        file_path: path.to_string_lossy().to_string(),
        content_hash: sha256(content),
        word_count: content.chars().filter(|ch| !ch.is_whitespace()).count(),
    }
}

fn is_skill_manifest_file(path: &Path) -> bool {
    match path.file_name().and_then(|value| value.to_str()) {
        Some(file_name) => file_name.ends_with(".skill.yaml") || file_name.ends_with(".skill.yml"),
        None => false,
    }
}

fn sha256(input: &str) -> String {
    let mut hasher = Sha256::new();
    hasher.update(input.as_bytes());
    format!("{:x}", hasher.finalize())
}

fn parse_json_list(input: &str) -> Vec<String> {
    serde_json::from_str(input).unwrap_or_default()
}
