import { describe, expect, it, vi } from 'vitest'
import { createProjectPersistence } from './projectPersistence'

describe('project persistence', () => {
  it('does not call Tauri file writes in the browser demo runtime', async () => {
    const writeChapter = vi.fn()
    const persistence = createProjectPersistence({
      detector: { isTauri: () => false },
      writeChapter,
    })

    await persistence.saveChapter('chapter.md', 'content')

    expect(writeChapter).not.toHaveBeenCalled()
  })

  it('writes chapter content through the Tauri adapter when available', async () => {
    const writeChapter = vi.fn().mockResolvedValue(undefined)
    const persistence = createProjectPersistence({
      detector: { isTauri: () => true },
      writeChapter,
    })

    await persistence.saveChapter('chapter.md', 'content')

    expect(writeChapter).toHaveBeenCalledWith('chapter.md', 'content')
  })

  it('propagates persistence failures so the editor does not fake a save', async () => {
    const persistence = createProjectPersistence({
      detector: { isTauri: () => true },
      writeChapter: vi.fn().mockRejectedValue(new Error('disk full')),
    })

    await expect(persistence.saveChapter('chapter.md', 'content')).rejects.toThrow(
      'disk full',
    )
  })
})
