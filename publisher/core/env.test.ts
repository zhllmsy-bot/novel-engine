import { describe, expect, it } from 'vitest'
import { parseEnv } from './env.ts'
import { createFanqieConfig, extractFanqieBookId } from './fanqie.ts'

describe('publisher env config', () => {
  it('parses dotenv-style key values', () => {
    expect(
      parseEnv(`
# comment
PUBLISH_DRY_RUN=1
wenzhang_menu="./manuscript"
ignored
`),
    ).toEqual({
      PUBLISH_DRY_RUN: '1',
      wenzhang_menu: './manuscript',
    })
  })

  it('extracts Fanqie book id from writer URLs', () => {
    expect(
      extractFanqieBookId(
        'https://fanqienovel.com/main/writer/987654321/chapter-manage',
      ),
    ).toBe('987654321')
    expect(
      extractFanqieBookId(
        'https://fanqienovel.com/main/writer/book-manage/chapter-manage/123',
      ),
    ).toBe('123')
  })

  it('builds Fanqie config with env-file-relative paths', () => {
    const config = createFanqieConfig(
      {
        xiaoshuo_menu:
          'https://fanqienovel.com/main/writer/1234567890/chapter-manage',
        wenzhang_menu: '../../../examples/demo-novel/manuscript/volume-001',
        PUBLISH_PROGRESS_PATH: '../../../.novel/progress.json',
        PUBLISH_INTERVAL_SECONDS: '7',
      },
      '/repo/publisher/adapters/fanqie/.env',
    )

    expect(config.bookId).toBe('1234567890')
    expect(config.chaptersDir).toBe(
      '/repo/examples/demo-novel/manuscript/volume-001',
    )
    expect(config.progressPath).toBe('/repo/.novel/progress.json')
    expect(config.intervalSeconds).toBe(7)
    expect(config.dryRun).toBe(true)
  })
})
