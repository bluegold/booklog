import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchBookMetadataFromOpenBd } from './openbd.js'

describe('openbd', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns null when API responds with non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))

    const result = await fetchBookMetadataFromOpenBd('9784003101018')

    expect(result).toBeNull()
  })

  it('returns null when first item is null', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [null],
      })
    )

    const result = await fetchBookMetadataFromOpenBd('9784003101018')

    expect(result).toBeNull()
  })

  it('returns null when summary is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [{}],
      })
    )

    const result = await fetchBookMetadataFromOpenBd('9784003101018')

    expect(result).toBeNull()
  })

  it('returns null when title is missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          {
            summary: {
              author: '著者',
              publisher: '出版社',
              pubdate: '20200101',
              cover: 'https://example.com/cover.jpg',
            },
          },
        ],
      })
    )

    const result = await fetchBookMetadataFromOpenBd('9784003101018')

    expect(result).toBeNull()
  })

  it('parses metadata and normalizes full date format', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [
        {
          summary: {
            title: '吾輩は猫である',
            author: '夏目漱石',
            publisher: '新潮社',
            pubdate: '19051125',
            cover: 'https://example.com/wagahai.jpg',
          },
        },
      ],
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchBookMetadataFromOpenBd('978-4-00-310101-8')

    expect(fetchMock).toHaveBeenCalledWith('https://api.openbd.jp/v1/get?isbn=978-4-00-310101-8')
    expect(result).toEqual({
      title: '吾輩は猫である',
      author: '夏目漱石',
      publisher: '新潮社',
      published_at: '1905-11-25',
      cover_url: 'https://example.com/wagahai.jpg',
    })
  })

  it('falls back optional fields to empty strings and normalizes year-month date', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          {
            summary: {
              title: 'タイトルのみ',
              pubdate: '198801',
            },
          },
        ],
      })
    )

    const result = await fetchBookMetadataFromOpenBd('9784003101018')

    expect(result).toEqual({
      title: 'タイトルのみ',
      author: '',
      publisher: '',
      published_at: '1988-01',
      cover_url: '',
    })
  })

  it('keeps non-date pubdate text when digit count is less than 4', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => [
          {
            summary: {
              title: '特殊日付',
              pubdate: '春号',
            },
          },
        ],
      })
    )

    const result = await fetchBookMetadataFromOpenBd('9784003101018')

    expect(result?.published_at).toBe('春号')
  })

  it('writes debug logs and warnings when debug flag is true', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 429 }))
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const result = await fetchBookMetadataFromOpenBd('9784003101018', true)

    expect(result).toBeNull()
    expect(logSpy).toHaveBeenCalledWith(
      '[openbd] request',
      expect.objectContaining({ isbn: '9784003101018' })
    )
    expect(logSpy).toHaveBeenCalledWith(
      '[openbd] response',
      expect.objectContaining({ status: 429, ok: false })
    )
    expect(warnSpy).toHaveBeenCalledWith(
      '[openbd] non-ok response',
      expect.objectContaining({ status: 429 })
    )
  })
})
