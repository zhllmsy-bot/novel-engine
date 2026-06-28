import { readdir, readFile, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import {
  parsePublisherAdapterManifest,
  type PublisherAdapterManifest,
} from './adapterManifest.ts'

export async function loadPublisherAdapterManifests(
  rootPath = 'publisher/adapters',
): Promise<PublisherAdapterManifest[]> {
  const files = await collectPublisherAdapterManifestFiles(rootPath)
  const manifests: PublisherAdapterManifest[] = []

  for (const file of files) {
    const result = parsePublisherAdapterManifest(await readFile(file, 'utf8'))
    if (result.ok) {
      manifests.push(result.manifest)
    }
  }

  return manifests.sort((left, right) => left.id.localeCompare(right.id))
}

export async function collectPublisherAdapterManifestFiles(
  rootPath = 'publisher/adapters',
): Promise<string[]> {
  const absoluteRoot = resolve(rootPath)

  if (!(await pathExists(absoluteRoot))) {
    return []
  }

  const files: string[] = []
  await collectManifestPath(absoluteRoot, files)
  return files.sort((left, right) => left.localeCompare(right))
}

async function collectManifestPath(path: string, files: string[]): Promise<void> {
  const pathStat = await stat(path)

  if (pathStat.isFile()) {
    if (path.endsWith('publisher.adapter.json')) {
      files.push(path)
    }
    return
  }

  if (!pathStat.isDirectory()) {
    return
  }

  const entries = await readdir(path, { withFileTypes: true })
  await Promise.all(
    entries.map((entry) => collectManifestPath(join(path, entry.name), files)),
  )
}

async function pathExists(path: string) {
  try {
    await stat(path)
    return true
  } catch {
    return false
  }
}
