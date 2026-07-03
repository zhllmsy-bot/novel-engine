use chrono::Utc;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;
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
    #[error("{0}")]
    InvalidImport(String),
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

#[derive(Debug, Serialize, Clone)]
pub struct ChapterSearchResult {
    pub chapter_id: String,
    pub chapter_title: String,
    pub file_path: String,
    pub snippet: String,
    pub score: f64,
    pub source: String,
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

#[derive(Debug, Serialize)]
pub struct ImportedNovelChapterInfo {
    pub id: String,
    pub title: String,
    pub path: String,
    pub order: usize,
}

#[derive(Debug, Serialize)]
pub struct ImportedNovelStats {
    pub chapters: usize,
    pub codex_entries: usize,
    pub source_markdown_files: usize,
    pub raw_ledger_files: usize,
}

#[derive(Debug, Serialize)]
pub struct ImportedNovelProjectReport {
    pub path: String,
    pub source_path: String,
    pub title: String,
    pub latest_chapter: Option<ImportedNovelChapterInfo>,
    pub next_chapter_path: Option<String>,
    pub stats: ImportedNovelStats,
    pub warnings: Vec<String>,
}

struct SourceImportChapter {
    number: usize,
    content: String,
}

struct ImportedChapter {
    id: String,
    title: String,
    target_path: String,
    order: usize,
    content: String,
}

pub fn import_existing_project(
    source_path: String,
    output_path: String,
    title: Option<String>,
    chapters_per_volume: Option<usize>,
) -> Result<ImportedNovelProjectReport, ProjectError> {
    let source_root = normalize_project_path(source_path)?;
    let output_root = normalize_project_path(output_path)?;
    let chapters_per_volume = chapters_per_volume.unwrap_or(30);
    if chapters_per_volume == 0 {
        return Err(ProjectError::InvalidImport(
            "chapters_per_volume must be a positive integer".to_string(),
        ));
    }
    if !source_root.is_dir() {
        return Err(ProjectError::InvalidImport(format!(
            "source path is not a directory: {}",
            source_root.to_string_lossy()
        )));
    }
    assert_import_output_is_safe(&output_root)?;

    let source_chapters = discover_import_chapters(&source_root)?;
    if source_chapters.is_empty() {
        return Err(ProjectError::InvalidImport(format!(
            "no Markdown chapters found under {}",
            source_root.to_string_lossy()
        )));
    }

    let title = title
        .filter(|value| !value.trim().is_empty())
        .unwrap_or_else(|| infer_import_title(&source_root));
    let mut imported_chapters = Vec::new();
    for chapter in source_chapters {
        let target_path = manuscript_path_for_order(chapter.number, chapters_per_volume);
        let title = markdown_title(&chapter.content, &format!("第{:03}章", chapter.number));
        let target_file = output_root.join(&target_path);
        if let Some(parent) = target_file.parent() {
            fs::create_dir_all(parent)?;
        }
        fs::write(&target_file, &chapter.content)?;
        imported_chapters.push(ImportedChapter {
            id: format!("chapter-{:03}", chapter.number),
            title,
            target_path,
            order: chapter.number,
            content: chapter.content,
        });
    }

    fs::create_dir_all(output_root.join("meta"))?;
    fs::write(
        output_root.join("meta").join("project.json"),
        serde_json::to_string_pretty(&import_project_manifest(&title, &imported_chapters))?,
    )?;
    fs::write(
        output_root.join("meta").join("memory-eval.json"),
        serde_json::to_string_pretty(&import_memory_eval_config(&imported_chapters))?,
    )?;
    fs::write(
        output_root.join(".gitignore"),
        ".DS_Store\n.novel/*.db\n.novel/*.db-*\n",
    )?;

    let codex_entries =
        write_import_codex(&source_root, &output_root, &title, &imported_chapters)?;
    let source_markdown_files = copy_import_source_references(&source_root, &output_root)?;
    let raw_ledger_files = copy_import_ledger_references(&source_root, &output_root)?;
    copy_import_upload_references(&source_root, &output_root)?;
    let mut warnings = Vec::new();
    if let Some(claimed) = infer_claimed_chapter_count(&source_root) {
        if claimed != imported_chapters.len() {
            warnings.push(format!(
                "source README claims {} chapters, but {} chapter files were imported.",
                claimed,
                imported_chapters.len()
            ));
        }
    }

    let latest = imported_chapters.last().map(|chapter| ImportedNovelChapterInfo {
        id: chapter.id.clone(),
        title: chapter.title.clone(),
        path: chapter.target_path.clone(),
        order: chapter.order,
    });
    let next_chapter_path = imported_chapters
        .last()
        .map(|chapter| manuscript_path_for_order(chapter.order + 1, chapters_per_volume));

    write_import_file(
        &output_root.join("references").join("import-report.md"),
        &import_report_markdown(
            &source_root,
            &output_root,
            &title,
            &imported_chapters,
            next_chapter_path.as_deref(),
            &warnings,
        ),
    )?;
    init_cache(output_root.to_string_lossy().to_string())?;

    Ok(ImportedNovelProjectReport {
        path: output_root.to_string_lossy().to_string(),
        source_path: source_root.to_string_lossy().to_string(),
        title,
        latest_chapter: latest,
        next_chapter_path,
        stats: ImportedNovelStats {
            chapters: imported_chapters.len(),
            codex_entries,
            source_markdown_files,
            raw_ledger_files,
        },
        warnings,
    })
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
        "source_of_truth": "markdown",
        "chapters": [
            {
                "id": "chapter-001",
                "title": "第001章",
                "path": "manuscript/volume-001/chapter-001.md",
                "order": 1,
                "story_time": {
                    "label": "开篇当日",
                    "sort_key": 1
                },
                "scene_def_ids": ["scene-opening-gate"]
            }
        ]
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
        fs::write(first_chapter, "# 第001章\n\n从这里开始写作。主角站在雨中的山门前。\n")?;
    }

    let protagonist_card = root
        .join("codex")
        .join("characters")
        .join("protagonist.md");
    if !protagonist_card.exists() {
        fs::write(
            protagonist_card,
            "---\nid: char-protagonist\nname: 主角\ntype: character\naliases: [主角]\nkeywords: [主角]\n---\n\n补充主角的外貌、性格、目标和当前状态。\n",
        )?;
    }

    let opening_scene_card = root
        .join("codex")
        .join("locations")
        .join("opening-gate.md");
    if !opening_scene_card.exists() {
        fs::write(
            opening_scene_card,
            "---\nid: scene-opening-gate\nname: 开篇场景\ntype: scene_def\nkeywords: [开篇场景, 山门, 雨中山门]\n---\n\n记录本章主要发生地点、氛围、限制条件和可复用的场面元素。\n",
        )?;
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
    rebuild_chapter_fts(&conn)?;
    Ok(())
}

pub fn search_chapter_index(
    path: String,
    query: String,
    limit: usize,
) -> Result<Vec<ChapterSearchResult>, ProjectError> {
    let (_root, conn) = open_cache(path)?;
    let normalized_query = normalize_fts_query(&query);

    if normalized_query.is_empty() {
        return Ok(Vec::new());
    }

    let capped_limit = limit.clamp(1, 20) as i64;
    let mut stmt = conn.prepare(
        r#"
        SELECT
          ch.id,
          ch.title,
          ch.file_path,
          snippet(chapter_fts, 1, '', '', '…', 18) AS content_snippet,
          snippet(chapter_fts, 2, '', '', '…', 18) AS summary_snippet,
          bm25(chapter_fts, 4.0, 1.0, 2.5) AS rank
        FROM chapter_fts
        JOIN chapter ch ON ch.rowid = chapter_fts.rowid
        WHERE chapter_fts MATCH ?1
        ORDER BY rank ASC, ch.order_idx ASC
        LIMIT ?2
        "#,
    )?;
    let matches = stmt.query_map(params![normalized_query, capped_limit], |row| {
        let content_snippet: String = row.get(3)?;
        let summary_snippet: String = row.get(4)?;
        let rank: f64 = row.get(5)?;

        Ok(ChapterSearchResult {
            chapter_id: row.get(0)?,
            chapter_title: row.get(1)?,
            file_path: row.get(2)?,
            snippet: pick_snippet(&summary_snippet, &content_snippet),
            score: -rank,
            source: if !summary_snippet.trim().is_empty() {
                "summary".to_string()
            } else {
                "content".to_string()
            },
        })
    })?;

    let mut results = Vec::new();
    for result in matches {
        results.push(result?);
    }
    Ok(results)
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

fn assert_import_output_is_safe(path: &Path) -> Result<(), ProjectError> {
    if !path.exists() {
        return Ok(());
    }
    if !path.is_dir() {
        return Err(ProjectError::InvalidImport(format!(
            "output path is not a directory: {}",
            path.to_string_lossy()
        )));
    }

    let has_content = fs::read_dir(path)?.any(|entry| {
        entry
            .ok()
            .and_then(|entry| entry.file_name().into_string().ok())
            .map(|name| name != ".DS_Store")
            .unwrap_or(true)
    });

    if has_content {
        return Err(ProjectError::InvalidImport(
            "导入目标文件夹必须为空，避免覆盖已有稿件。".to_string(),
        ));
    }

    Ok(())
}

fn discover_import_chapters(source_root: &Path) -> Result<Vec<SourceImportChapter>, ProjectError> {
    let chapters_root = source_root.join("chapters");
    let root = if chapters_root.is_dir() {
        chapters_root
    } else {
        source_root.to_path_buf()
    };
    let mut chapters = Vec::new();

    for entry in fs::read_dir(root)? {
        let entry = entry?;
        if !entry.file_type()?.is_file() {
            continue;
        }
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("md") {
            continue;
        }
        let Some(stem) = path.file_stem().and_then(|value| value.to_str()) else {
            continue;
        };
        if !stem.chars().all(|ch| ch.is_ascii_digit()) {
            continue;
        }
        let Ok(number) = stem.parse::<usize>() else {
            continue;
        };
        chapters.push(SourceImportChapter {
            number,
            content: fs::read_to_string(path)?,
        });
    }

    chapters.sort_by_key(|chapter| chapter.number);
    Ok(chapters)
}

fn import_project_manifest(title: &str, chapters: &[ImportedChapter]) -> serde_json::Value {
    serde_json::json!({
        "schema_version": 1,
        "title": title,
        "source_of_truth": "markdown",
        "chapters": chapters.iter().map(|chapter| {
            serde_json::json!({
                "id": &chapter.id,
                "title": &chapter.title,
                "path": &chapter.target_path,
                "order": chapter.order,
            })
        }).collect::<Vec<_>>()
    })
}

fn import_memory_eval_config(chapters: &[ImportedChapter]) -> serde_json::Value {
    let latest = chapters.last();
    serde_json::json!({
        "chapter_id": latest.map(|chapter| chapter.id.as_str()).unwrap_or("chapter-001"),
        "budget_chars": 1200,
        "minimum_gain": 0,
        "expectations": [
            {
                "id": "import-l2-current-prose",
                "description": "Imported project keeps the latest chapter prose available for continuation.",
                "layer": "L2 风格",
                "contains": ["当前章节原文", latest.map(|chapter| chapter.title.as_str()).unwrap_or("当前章节原文")]
            },
            {
                "id": "import-l0-continuation-card",
                "description": "Imported project exposes a continuation-state card for the next writing step.",
                "layer": "L0 事实",
                "contains": ["续写状态"],
                "source_contains": ["codex/notes/continuation-state.md"],
                "source_families": ["codex"]
            }
        ]
    })
}

fn write_import_codex(
    source_root: &Path,
    output_root: &Path,
    title: &str,
    chapters: &[ImportedChapter],
) -> Result<usize, ProjectError> {
    let mut count = 0;
    let known_markdown = [
        (
            "README.md",
            "codex/notes/source-readme.md",
            "note-source-readme",
            "源项目说明",
            "note",
            vec!["源项目说明", "导入来源", "续写原则"],
        ),
        (
            "bible.md",
            "codex/world/bible.md",
            "world-source-bible",
            "小说 Bible",
            "world",
            vec!["小说 Bible", "核心设定", "角色", "势力", "能力", "卷结构"],
        ),
        (
            "outline-first-30.md",
            "codex/notes/outline-first-30.md",
            "note-outline-first-30",
            "前30章大纲",
            "note",
            vec!["前30章大纲", "前30章", "大纲", "节奏", "爽点"],
        ),
        (
            "quality-check.md",
            "codex/notes/quality-check.md",
            "note-quality-check",
            "质量检查",
            "note",
            vec!["质量检查", "续写", "爽点", "风险", "未解伏笔"],
        ),
    ];

    for (file_name, target_path, id, name, card_type, keywords) in known_markdown {
        let source_path = source_root.join(file_name);
        if !source_path.is_file() {
            continue;
        }
        write_import_file(
            &output_root.join(target_path),
            &codex_card(
                id,
                name,
                card_type,
                unique_strings([vec![name.to_string(), title.to_string()], strings(keywords)].concat()),
                &fs::read_to_string(source_path)?,
            ),
        )?;
        count += 1;
    }

    count += write_import_ledgers(source_root, output_root, title)?;
    write_import_file(
        &output_root.join("codex").join("notes").join("continuation-state.md"),
        &continuation_state_card(title, chapters),
    )?;
    count += 1;

    Ok(count)
}

fn write_import_ledgers(
    source_root: &Path,
    output_root: &Path,
    title: &str,
) -> Result<usize, ProjectError> {
    let ledgers_root = source_root.join("ledgers");
    if !ledgers_root.is_dir() {
        return Ok(0);
    }

    let mut count = 0;
    for entry in fs::read_dir(ledgers_root)? {
        let entry = entry?;
        if !entry.file_type()?.is_file() {
            continue;
        }
        let path = entry.path();
        let stem = path
            .file_stem()
            .and_then(|value| value.to_str())
            .unwrap_or("ledger");
        let label = import_ledger_label(stem);
        let source = fs::read_to_string(&path)?;
        let body = if path.extension().and_then(|value| value.to_str()) == Some("jsonl") {
            jsonl_to_markdown(&source, &label)
        } else {
            source
        };
        write_import_file(
            &output_root
                .join("codex")
                .join("ledgers")
                .join(format!("{}.md", stem)),
            &codex_card(
                &format!("ledger-{}", slug_for_import(stem)),
                &label,
                "note",
                ledger_keywords(stem, &label, title),
                &body,
            ),
        )?;
        count += 1;
    }

    Ok(count)
}

fn continuation_state_card(title: &str, chapters: &[ImportedChapter]) -> String {
    let latest = chapters.last();
    let next_order = latest.map(|chapter| chapter.order + 1).unwrap_or(1);
    let latest_tail = latest
        .map(|chapter| latest_chapter_tail(&chapter.content))
        .unwrap_or_default();
    let mut keywords = vec![
        "续写状态".to_string(),
        title.to_string(),
        format!("第{}章", next_order),
    ];
    if let Some(chapter) = latest {
        keywords.push(chapter.title.clone());
    }
    keywords.extend(code_terms(&latest_tail).into_iter().take(5));

    codex_card(
        "note-continuation-state",
        "续写状态",
        "note",
        unique_strings(keywords),
        &format!(
            "# 续写状态\n\n- 当前已导入 {} 章。{}\n- 下一章建议从第 {} 章接续。\n{}\n## 最新章节末段锚点\n\n{}",
            chapters.len(),
            latest
                .map(|chapter| format!("最新章节是《{}》。", chapter.title))
                .unwrap_or_default(),
            next_order,
            latest
                .map(|chapter| format!("- 最新章节路径：{}\n", chapter.target_path))
                .unwrap_or_default(),
            if latest_tail.is_empty() { "暂无。".to_string() } else { latest_tail }
        ),
    )
}

fn copy_import_source_references(source_root: &Path, output_root: &Path) -> Result<usize, ProjectError> {
    let mut count = 0;
    for entry in fs::read_dir(source_root)? {
        let entry = entry?;
        if !entry.file_type()?.is_file() {
            continue;
        }
        let path = entry.path();
        if path.extension().and_then(|value| value.to_str()) != Some("md") {
            continue;
        }
        let Some(file_name) = path.file_name() else {
            continue;
        };
        copy_import_file(&path, &output_root.join("references").join("source").join(file_name))?;
        count += 1;
    }

    Ok(count)
}

fn copy_import_ledger_references(source_root: &Path, output_root: &Path) -> Result<usize, ProjectError> {
    copy_import_reference_dir(source_root, output_root, "ledgers", "ledgers")
}

fn copy_import_upload_references(source_root: &Path, output_root: &Path) -> Result<(), ProjectError> {
    copy_import_reference_dir(source_root, output_root, "upload", "upload")?;
    Ok(())
}

fn copy_import_reference_dir(
    source_root: &Path,
    output_root: &Path,
    source_dir: &str,
    target_dir: &str,
) -> Result<usize, ProjectError> {
    let root = source_root.join(source_dir);
    if !root.is_dir() {
        return Ok(0);
    }
    let mut count = 0;
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        if !entry.file_type()?.is_file() {
            continue;
        }
        let path = entry.path();
        let Some(file_name) = path.file_name() else {
            continue;
        };
        copy_import_file(&path, &output_root.join("references").join(target_dir).join(file_name))?;
        count += 1;
    }
    Ok(count)
}

fn import_report_markdown(
    source_root: &Path,
    output_root: &Path,
    title: &str,
    chapters: &[ImportedChapter],
    next_chapter_path: Option<&str>,
    warnings: &[String],
) -> String {
    let latest = chapters.last();
    let warning_section = if warnings.is_empty() {
        String::new()
    } else {
        format!(
            "\n## Warnings\n\n{}\n",
            warnings
                .iter()
                .map(|warning| format!("- {}", warning))
                .collect::<Vec<_>>()
                .join("\n")
        )
    };

    format!(
        "# 导入说明\n\n- Source: {}\n- Output: {}\n- Title: {}\n- Imported chapters: {}\n- Chapter layout: generated under manuscript/volume-xxx while preserving order in meta/project.json.\n{}{}{}",
        source_root.to_string_lossy(),
        output_root.to_string_lossy(),
        title,
        chapters.len(),
        latest
            .map(|chapter| format!(
                "- Latest chapter: {}\n- Latest chapter path: {}\n",
                chapter.title, chapter.target_path
            ))
            .unwrap_or_default(),
        next_chapter_path
            .map(|path| format!("- Next continuation chapter path: {}\n", path))
            .unwrap_or_default(),
        warning_section
    )
}

fn write_import_file(path: &Path, content: &str) -> Result<(), ProjectError> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::write(path, content)?;
    Ok(())
}

fn copy_import_file(source: &Path, target: &Path) -> Result<(), ProjectError> {
    if let Some(parent) = target.parent() {
        fs::create_dir_all(parent)?;
    }
    fs::copy(source, target)?;
    Ok(())
}

fn infer_import_title(source_root: &Path) -> String {
    if let Ok(readme) = fs::read_to_string(source_root.join("README.md")) {
        if let Some(line) = readme.lines().find(|line| line.trim_start().starts_with('#')) {
            let title = line
                .trim_start_matches('#')
                .trim()
                .trim_start_matches('《')
                .trim_end_matches('》')
                .trim_end_matches("项目包")
                .trim();
            if !title.is_empty() {
                return title.to_string();
            }
        }
    }

    source_root
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("ImportedNovel")
        .to_string()
}

fn infer_claimed_chapter_count(source_root: &Path) -> Option<usize> {
    let readme = fs::read_to_string(source_root.join("README.md")).ok()?;
    let mut numbers = Vec::new();
    let mut current = String::new();
    for ch in readme.chars() {
        if ch.is_ascii_digit() {
            current.push(ch);
            continue;
        }
        if ch.is_whitespace() && !current.is_empty() {
            continue;
        }
        if ch == '章' && !current.is_empty() {
            if let Ok(value) = current.parse::<usize>() {
                numbers.push(value);
            }
        }
        current.clear();
    }

    numbers.into_iter().max()
}

fn manuscript_path_for_order(order: usize, chapters_per_volume: usize) -> String {
    let volume = (order + chapters_per_volume - 1) / chapters_per_volume;
    format!(
        "manuscript/volume-{:03}/chapter-{:03}.md",
        volume, order
    )
}

fn markdown_title(content: &str, fallback: &str) -> String {
    content
        .lines()
        .find(|line| line.trim_start().starts_with('#'))
        .map(|line| line.trim().trim_start_matches('#').trim().to_string())
        .filter(|line| !line.is_empty())
        .unwrap_or_else(|| fallback.to_string())
}

fn latest_chapter_tail(content: &str) -> String {
    let lines: Vec<_> = content
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect();
    let start = lines.len().saturating_sub(36);
    lines[start..].join("\n")
}

fn code_terms(input: &str) -> Vec<String> {
    let mut terms = Vec::new();
    for raw in input.split(|ch: char| !ch.is_ascii_alphanumeric() && ch != '-') {
        let token = raw.trim();
        if token.len() >= 4 && token.chars().any(|ch| ch.is_ascii_uppercase()) {
            terms.push(token.to_string());
        }
    }
    unique_strings(terms)
}

fn import_ledger_label(stem: &str) -> String {
    match stem {
        "ability" => "能力账本".to_string(),
        "facts" => "事实账本".to_string(),
        "factions" => "势力账本".to_string(),
        "promises" => "承诺账本".to_string(),
        "relationships" => "关系账本".to_string(),
        _ => format!("{} ledger", stem),
    }
}

fn ledger_keywords(stem: &str, label: &str, title: &str) -> Vec<String> {
    let base = match stem {
        "ability" => vec!["能力", "能力账本", "风险线", "代价"],
        "facts" => vec!["事实", "事实账本", "阶段性答案", "异常成立"],
        "factions" => vec!["势力", "势力账本", "组织", "资源"],
        "promises" => vec!["承诺", "承诺账本", "伏笔", "回收期"],
        "relationships" => vec!["关系", "关系账本", "关系线", "信任"],
        "timeline" => vec!["时间线", "时间线账本", "故事时间"],
        "unresolved" => vec!["未解问题", "未解问题账本", "下一步"],
        _ => vec![stem, label],
    };
    unique_strings([vec![label.to_string(), title.to_string()], strings(base)].concat())
        .into_iter()
        .take(8)
        .collect()
}

fn jsonl_to_markdown(source: &str, title: &str) -> String {
    let mut lines = Vec::new();
    for line in source.lines().map(str::trim).filter(|line| !line.is_empty()) {
        let rendered = serde_json::from_str::<serde_json::Value>(line)
            .ok()
            .and_then(|value| value.as_object().cloned())
            .map(|object| {
                object
                    .iter()
                    .map(|(key, value)| format!("{}: {}", key, render_import_json_value(value)))
                    .collect::<Vec<_>>()
                    .join("；")
            })
            .unwrap_or_else(|| line.to_string());
        lines.push(format!("- {}", rendered));
    }

    format!("# {}\n\n{}\n", title, lines.join("\n"))
}

fn render_import_json_value(value: &serde_json::Value) -> String {
    match value {
        serde_json::Value::Array(items) => items
            .iter()
            .map(render_import_json_value)
            .collect::<Vec<_>>()
            .join("、"),
        serde_json::Value::String(value) => value.clone(),
        _ => value.to_string(),
    }
}

fn codex_card(
    id: &str,
    name: &str,
    card_type: &str,
    keywords: Vec<String>,
    body: &str,
) -> String {
    format!(
        "---\nid: {}\nname: {}\ntype: {}\nkeywords: [{}]\n---\n\n{}\n",
        yaml_string(id),
        yaml_string(name),
        yaml_string(card_type),
        keywords
            .iter()
            .map(|value| yaml_string(value))
            .collect::<Vec<_>>()
            .join(", "),
        body.trim()
    )
}

fn yaml_string(value: &str) -> String {
    serde_json::to_string(value).unwrap_or_else(|_| "\"\"".to_string())
}

fn slug_for_import(value: &str) -> String {
    let ascii = value
        .trim()
        .to_lowercase()
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch } else { '-' })
        .collect::<String>()
        .trim_matches('-')
        .to_string();

    if !ascii.is_empty() {
        return ascii;
    }

    value
        .chars()
        .map(|ch| format!("{:x}", ch as u32))
        .collect::<Vec<_>>()
        .join("-")
}

fn unique_strings(values: Vec<String>) -> Vec<String> {
    let mut unique: Vec<String> = Vec::new();
    for value in values {
        let value = value.trim();
        if value.is_empty() || unique.iter().any(|existing| existing.as_str() == value) {
            continue;
        }
        unique.push(value.to_string());
    }
    unique
}

fn strings(values: Vec<&str>) -> Vec<String> {
    values.into_iter().map(str::to_string).collect()
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

        DROP TABLE IF EXISTS chapter_fts;

        CREATE VIRTUAL TABLE chapter_fts
        USING fts5(title, content, summary, tokenize='trigram');
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

    rebuild_chapter_fts(conn)?;
    Ok(())
}

fn rebuild_chapter_fts(conn: &Connection) -> Result<(), ProjectError> {
    conn.execute("DELETE FROM chapter_fts", [])?;
    let mut stmt = conn.prepare(
        r#"
        SELECT
          ch.rowid,
          ch.title,
          ch.content,
          COALESCE(cs.summary, '') AS summary
        FROM chapter ch
        LEFT JOIN chapter_summary cs ON cs.chapter_id = ch.id
        ORDER BY ch.order_idx ASC, ch.id ASC
        "#,
    )?;
    let rows = stmt.query_map([], |row| {
        Ok((
            row.get::<_, i64>(0)?,
            row.get::<_, String>(1)?,
            row.get::<_, String>(2)?,
            row.get::<_, String>(3)?,
        ))
    })?;

    for row in rows {
        let (rowid, title, content, summary) = row?;
        conn.execute(
            "INSERT INTO chapter_fts(rowid, title, content, summary) VALUES (?1, ?2, ?3, ?4)",
            params![rowid, title, content, summary],
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

fn normalize_fts_query(query: &str) -> String {
    let mut terms: BTreeMap<String, ()> = BTreeMap::new();

    for term in query
        .split(|ch: char| ch.is_whitespace() || is_query_separator(ch))
        .map(str::trim)
        .filter(|term| !term.is_empty())
    {
        terms.insert(term.to_string(), ());
    }

    terms
        .keys()
        .map(|term| format!("\"{}\"", term.replace('"', "\"\"")))
        .collect::<Vec<_>>()
        .join(" OR ")
}

fn is_query_separator(ch: char) -> bool {
    matches!(
        ch,
        ',' | '，'
            | '、'
            | ';'
            | '；'
            | ':'
            | '：'
            | '.'
            | '。'
            | '!'
            | '！'
            | '?'
            | '？'
            | '('
            | ')'
            | '（'
            | '）'
            | '['
            | ']'
            | '【'
            | '】'
    )
}

fn pick_snippet(summary_snippet: &str, content_snippet: &str) -> String {
    let summary = summary_snippet.trim();
    if !summary.is_empty() {
        return summary.to_string();
    }

    content_snippet.trim().to_string()
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn create_project_writes_manifest_story_time_and_scene_def_card() {
        let root = unique_test_project_root("create-project");

        create_project(root.to_string_lossy().to_string(), "新书".to_string()).unwrap();

        let manifest = fs::read_to_string(root.join("meta").join("project.json")).unwrap();
        assert!(manifest.contains("\"source_of_truth\": \"markdown\""));
        assert!(manifest.contains("\"story_time\""));
        assert!(manifest.contains("\"scene_def_ids\""));
        assert!(!manifest.contains("\"created_at\""));

        let scene_card = fs::read_to_string(
            root.join("codex").join("locations").join("opening-gate.md"),
        )
        .unwrap();
        assert!(scene_card.contains("type: scene_def"));

        let protagonist_card = fs::read_to_string(
            root.join("codex").join("characters").join("protagonist.md"),
        )
        .unwrap();
        assert!(protagonist_card.contains("keywords: [主角]"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn chapter_search_indexes_scanned_content_and_summaries() {
        let root = unique_test_project_root("chapter-search");
        fs::create_dir_all(root.join("manuscript").join("volume-001")).unwrap();
        fs::create_dir_all(root.join("meta")).unwrap();
        fs::write(
            root.join("meta").join("project.json"),
            r#"{"title":"搜索测试","chapters":[]}"#,
        )
        .unwrap();
        fs::write(
            root.join("manuscript").join("volume-001").join("chapter-001.md"),
            "# 第一章 雨夜\n\n沈微第一次听见玄铁剑的声音。\n",
        )
        .unwrap();
        fs::write(
            root.join("manuscript").join("volume-001").join("chapter-002.md"),
            "# 第二章 剑阁\n\n剑阁里没有人提起镜湖钥。\n",
        )
        .unwrap();

        init_cache(root.to_string_lossy().to_string()).unwrap();
        upsert_chapter_summary(
            root.to_string_lossy().to_string(),
            ChapterSummaryPayload {
                chapter_id: "chapter-002".to_string(),
                source_hash: "hash".to_string(),
                summary: "简璃在镜湖留下青灯誓。".to_string(),
                key_events: vec!["青灯誓".to_string()],
                characters_involved: vec!["简璃".to_string()],
                is_edited: false,
                updated_at: "2026-01-01T00:00:00Z".to_string(),
            },
        )
        .unwrap();

        let content_results = search_chapter_index(
            root.to_string_lossy().to_string(),
            "玄铁剑".to_string(),
            5,
        )
        .unwrap();
        assert_eq!(content_results[0].chapter_id, "chapter-001");
        assert_eq!(content_results[0].source, "content");

        let summary_results =
            search_chapter_index(root.to_string_lossy().to_string(), "青灯誓".to_string(), 5)
                .unwrap();
        assert_eq!(summary_results[0].chapter_id, "chapter-002");
        assert_eq!(summary_results[0].source, "summary");
        assert!(summary_results[0].snippet.contains("青灯誓"));

        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn chapter_search_sanitizes_punctuation_queries() {
        let query = normalize_fts_query("玄铁剑, 青灯誓：镜湖钥");

        assert_eq!(query, "\"玄铁剑\" OR \"镜湖钥\" OR \"青灯誓\"");
    }

    #[test]
    fn import_existing_project_writes_checkable_continuation_project() {
        let source = unique_test_project_root("import-source");
        let output = unique_test_project_root("import-output");
        fs::create_dir_all(source.join("chapters")).unwrap();
        fs::create_dir_all(source.join("ledgers")).unwrap();
        fs::write(
            source.join("README.md"),
            "# 《旧稿项目包》\n\n当前交付：前 2 章正文。\n",
        )
        .unwrap();
        fs::write(source.join("chapters").join("001.md"), "# 第一章\n\n林砚被点名。").unwrap();
        fs::write(source.join("chapters").join("002.md"), "# 第二章\n\n风险线落下。").unwrap();
        fs::write(
            source.join("chapters").join("003.md"),
            "# 第三章 工印四号\n\n下一步路径指向 HOOK-03。",
        )
        .unwrap();
        fs::write(
            source.join("ledgers").join("promises.jsonl"),
            "{\"chapter\":1,\"promise\":\"林砚要洗清嫌疑。\"}\n",
        )
        .unwrap();

        let report = import_existing_project(
            source.to_string_lossy().to_string(),
            output.to_string_lossy().to_string(),
            Some("我能看见风险".to_string()),
            Some(2),
        )
        .unwrap();

        assert_eq!(report.stats.chapters, 3);
        assert_eq!(
            report.latest_chapter.as_ref().map(|chapter| chapter.path.as_str()),
            Some("manuscript/volume-002/chapter-003.md")
        );
        assert_eq!(
            report.next_chapter_path.as_deref(),
            Some("manuscript/volume-002/chapter-004.md")
        );
        assert!(report.warnings[0].contains("claims 2 chapters"));

        let manifest = fs::read_to_string(output.join("meta").join("project.json")).unwrap();
        assert!(manifest.contains("\"title\": \"我能看见风险\""));
        assert!(manifest.contains("chapter-003"));

        let continuation =
            fs::read_to_string(output.join("codex").join("notes").join("continuation-state.md"))
                .unwrap();
        assert!(continuation.contains("续写状态"));
        assert!(continuation.contains("HOOK-03"));
        let import_report =
            fs::read_to_string(output.join("references").join("import-report.md")).unwrap();
        assert!(import_report.contains("Imported chapters: 3"));
        assert!(import_report.contains("README claims 2 chapters"));
        assert_eq!(list_chapters(output.to_string_lossy().to_string()).unwrap().len(), 3);

        fs::remove_dir_all(source).unwrap();
        fs::remove_dir_all(output).unwrap();
    }

    fn unique_test_project_root(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!(
            "novel-engine-{}-{}",
            name,
            Utc::now().timestamp_nanos_opt().unwrap_or_default()
        ))
    }
}
