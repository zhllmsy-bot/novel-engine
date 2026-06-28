import chapter001 from '../../examples/demo-novel/manuscript/volume-001/chapter-001.md?raw'
import liZhanglaoCard from '../../examples/demo-novel/codex/characters/li-zhanglao.md?raw'
import projectJson from '../../examples/demo-novel/meta/project.json?raw'
import { loadProjectFromFiles } from './projectFileLoader'
import type { NovelProject, ProjectRepository } from './projectTypes'

const chapterAssets: Record<string, string> = {
  'manuscript/volume-001/chapter-001.md': chapter001,
}

const codexAssets: Record<string, string> = {
  'codex/characters/li-zhanglao.md': liZhanglaoCard,
}

export const demoProjectRepository: ProjectRepository = {
  async loadProject() {
    return loadDemoProject()
  },
}

export function loadDemoProject(): NovelProject {
  return loadProjectFromFiles({
    manifestSource: projectJson,
    chapterFiles: Object.entries(chapterAssets).map(([path, content]) => ({
      path,
      content,
    })),
    codexFiles: Object.entries(codexAssets).map(([path, content]) => ({
      path,
      content,
    })),
  })
}
