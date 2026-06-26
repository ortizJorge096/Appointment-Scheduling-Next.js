import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('fs/promises', () => ({ readdir: vi.fn() }))

const { readdir } = await import('fs/promises')
const { listHeroImages } = await import('./hero')

const mockFiles = (files: string[]) =>
  vi.mocked(readdir).mockResolvedValue(files as unknown as Awaited<ReturnType<typeof readdir>>)

describe('listHeroImages', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns image files as /hero/ paths in natural (numeric) order', async () => {
    mockFiles(['10.jpg', '2.jpg', '1.jpg'])
    expect(await listHeroImages()).toEqual(['/hero/1.jpg', '/hero/2.jpg', '/hero/10.jpg'])
  })

  it('filters out non-images, dotfiles and the video, case-insensitively', async () => {
    mockFiles(['1.jpg', 'hero-video.mp4', '.DS_Store', 'notes.txt', '2.PNG'])
    expect(await listHeroImages()).toEqual(['/hero/1.jpg', '/hero/2.PNG'])
  })

  it('returns [] when the folder is missing or unreadable', async () => {
    vi.mocked(readdir).mockRejectedValue(new Error('ENOENT'))
    expect(await listHeroImages()).toEqual([])
  })
})
