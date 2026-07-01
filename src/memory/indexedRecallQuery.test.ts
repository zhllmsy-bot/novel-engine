import { describe, expect, it } from 'vitest'
import type { CodexEntry } from '../project/projectTypes'
import {
  buildIndexedRecallQuery,
  extractIndexedRecallProseTerms,
} from './indexedRecallQuery'

const codexEntries: CodexEntry[] = [
  {
    id: 'item-mirror-lake-key',
    name: '镜湖钥',
    type: 'item',
    path: 'codex/items/mirror-lake-key.md',
    keywords: ['镜湖钥', '青灯誓'],
    body: '镜湖钥与青灯誓相关。',
    frontmatter: {},
    currentState: {},
  },
  {
    id: 'faction-dark-river',
    name: '暗河司',
    type: 'faction',
    path: 'codex/factions/dark-river.md',
    keywords: ['暗河司', '白塔'],
    body: '暗河司追索白塔旧档。',
    frontmatter: {},
    currentState: {},
  },
]

describe('indexed recall query', () => {
  it('prioritizes matched codex names and keywords for indexed recall', () => {
    const query = buildIndexedRecallQuery(
      '简璃提起镜湖钥，又说青灯誓不能落入暗河司。',
      codexEntries,
    )

    expect(query.split(' ')).toEqual(['镜湖钥', '青灯誓', '暗河司'])
  })

  it('extracts only proper-looking prose terms instead of sliding arbitrary Chinese windows', () => {
    const content = [
      '他指节被钥匙硌得发白，却没有说话。',
      '旧卷里第一次写到玄铁剑和无名封印。',
      '青灯誓在湖心重燃。',
    ].join('\n')

    expect(extractIndexedRecallProseTerms(content)).toEqual([
      '玄铁剑',
      '无名封印',
      '青灯誓',
    ])
    expect(buildIndexedRecallQuery(content, [])).toBe('玄铁剑 无名封印 青灯誓')
  })

  it('filters generic terms and caps the query width', () => {
    const query = buildIndexedRecallQuery(
      [
        '第一枚玄铁剑。',
        '第二枚青灯誓。',
        '第三枚镜湖钥。',
        '第四枚白塔旧卷。',
        '第五枚赤羽令。',
        '第六枚星沉阵。',
        '第七枚无名碑。',
        '第八枚云台阁。',
        '第九枚黑潮司。',
        '钥匙落在地上。',
      ].join('\n'),
      [],
    )
    const terms = query.split(' ')

    expect(terms).toHaveLength(8)
    expect(terms).not.toContain('钥匙')
  })
})
