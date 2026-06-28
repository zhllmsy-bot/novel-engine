import { open } from '@tauri-apps/plugin-dialog'
import { isTauriRuntime } from '../platform/runtime'
import {
  readProjectChapter,
  readProjectManifestFile,
  scanProjectChapters,
  scanProjectCodex,
} from '../platform/tauriProject'
import { loadProjectFromFiles } from './projectFileLoader'
import type { NovelProject } from './projectTypes'

type TauriProjectLoaderDeps = {
  readManifest?: typeof readProjectManifestFile
  scanChapters?: typeof scanProjectChapters
  scanCodex?: typeof scanProjectCodex
  readChapter?: typeof readProjectChapter
}

export async function pickAndLoadTauriProject(): Promise<NovelProject | null> {
  if (!isTauriRuntime()) {
    throw new Error('打开本地项目需要桌面端运行时。')
  }

  const selectedPath = await open({
    title: '选择小说项目文件夹',
    directory: true,
    multiple: false,
  })

  if (!selectedPath) {
    return null
  }

  return loadTauriProject(selectedPath)
}

export async function loadTauriProject(
  rootPath: string,
  deps: TauriProjectLoaderDeps = {},
): Promise<NovelProject> {
  const readManifest = deps.readManifest || readProjectManifestFile
  const scanChapters = deps.scanChapters || scanProjectChapters
  const scanCodex = deps.scanCodex || scanProjectCodex
  const readChapter = deps.readChapter || readProjectChapter
  const [manifestSource, scannedChapters, codexFiles] = await Promise.all([
    readManifest(rootPath),
    scanChapters(rootPath),
    scanCodex(rootPath),
  ])
  const chapterFiles = await Promise.all(
    scannedChapters.map(async (chapter) => ({
      path: relativeProjectPath(rootPath, chapter.file_path),
      filePath: chapter.file_path,
      content: await readChapter(chapter.file_path),
    })),
  )

  return loadProjectFromFiles({
    rootPath,
    manifestSource,
    chapterFiles,
    codexFiles: codexFiles.map((file) => ({
      path: file.file_path,
      content: file.content,
    })),
  })
}

function relativeProjectPath(rootPath: string, filePath: string) {
  const normalizedRoot = normalizePath(rootPath).replace(/\/$/, '')
  const normalizedFile = normalizePath(filePath)
  const prefix = `${normalizedRoot}/`

  return normalizedFile.startsWith(prefix)
    ? normalizedFile.slice(prefix.length)
    : normalizedFile
}

function normalizePath(path: string) {
  return path.replace(/\\/g, '/')
}
