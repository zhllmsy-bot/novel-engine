import { readFile } from 'node:fs/promises'
import { dirname, isAbsolute, resolve } from 'node:path'

export type EnvMap = Record<string, string>

export async function loadEnvFile(path: string): Promise<EnvMap> {
  const source = await readFile(path, 'utf8')
  return parseEnv(source)
}

export function parseEnv(source: string): EnvMap {
  const env: EnvMap = {}

  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex <= 0) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    const rawValue = line.slice(separatorIndex + 1).trim()
    env[key] = unquoteEnvValue(rawValue)
  }

  return env
}

export function resolveEnvPath(value: string, envFilePath: string): string {
  if (isAbsolute(value)) {
    return value
  }

  return resolve(dirname(envFilePath), value)
}

function unquoteEnvValue(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1)
  }

  return value
}
