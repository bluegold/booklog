import { beforeEach, describe, expect, it, vi } from 'vitest'
import app from './index.js'

type BookRow = {
  id: number
  isbn: string | null
  title: string | null
  author: string | null
  publisher: string | null
  created_at: string | null
}

type MockDbOptions = {
  initialBooks?: BookRow[]
  insertError?: Error
}

type CsrfContext = {
  token: string
  cookie: string
}

const createMockDb = (options: MockDbOptions = {}): D1Database => {
  const books: BookRow[] = [...(options.initialBooks ?? [])]
  let nextId = books.length + 1

  return {
    prepare(sql: string) {
      let boundParams: unknown[] = []

      return {
        bind(...params: unknown[]) {
          boundParams = params
          return this
        },
        async run() {
          if (!sql.startsWith('INSERT INTO books')) {
            return { success: true }
          }

          if (options.insertError) {
            throw options.insertError
          }

          const isbn = String(boundParams[0] ?? '')
          const title = boundParams[1] != null ? String(boundParams[1]) : null
          const author = boundParams[2] != null ? String(boundParams[2]) : null
          const publisher = boundParams[3] != null ? String(boundParams[3]) : null
          books.unshift({
            id: nextId,
            isbn,
            title,
            author,
            publisher,
            created_at: '2026-04-13 10:00:00',
          })
          nextId += 1

          return { success: true }
        },
        async all<T>() {
          if (sql.startsWith('SELECT id, isbn, title, author, publisher, created_at FROM books')) {
            return { results: books as T[] }
          }

          return { results: [] as T[] }
        },
      }
    },
  } as unknown as D1Database
}

const fetchCsrfContext = async (): Promise<CsrfContext> => {
  const res = await app.request('/')
  const body = await res.text()

  const tokenMatch = body.match(/name="csrf_token" value="([^"]+)"/)
  const cookieHeader = res.headers.get('set-cookie')

  const token = tokenMatch?.[1]
  const cookie = cookieHeader?.split(';')[0]

  if (!token || !cookie) {
    throw new Error('CSRF context was not issued')
  }

  return {
    token,
    cookie,
  }
}

type OpenBdResponse = Array<{ summary?: { title?: string; author?: string; publisher?: string } } | null>

const mockOpenBdFound = (title: string, author = '著者テスト', publisher = '出版社テスト'): void => {
  const body: OpenBdResponse = [{ summary: { title, author, publisher } }]
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => body }))
}

const mockOpenBdNotFound = (): void => {
  const body: OpenBdResponse = [null]
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => body }))
}

describe('reading log routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('GET / returns top page with form and list container', async () => {
    const res = await app.request('/')
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('Reading Log')
    expect(body).toContain('hx-post="/books"')
    expect(body).toContain('hx-get="/books"')
    expect(body).toContain('name="csrf_token"')
    expect(res.headers.get('set-cookie')).toContain('csrf_token=')
  })

  it('GET /books returns empty-state message when no books exist', async () => {
    const db = createMockDb()
    const res = await app.request('/books', undefined, { DB: db })
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('まだ登録がありません。')
  })

  it('POST /books rejects request when CSRF token is missing', async () => {
    const db = createMockDb()

    const res = await app.request(
      '/books',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ isbn: '9784003101018' }),
      },
      { DB: db }
    )

    const body = await res.text()
    expect(res.status).toBe(403)
    expect(body).toContain('不正なリクエストです。ページを再読み込みしてやり直してください。')
  })

  it('POST /books returns validation error for invalid ISBN format', async () => {
    const db = createMockDb()
    mockOpenBdNotFound()
    const csrf = await fetchCsrfContext()

    const res = await app.request(
      '/books',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: csrf.cookie,
        },
        body: new URLSearchParams({ isbn: 'abc', csrf_token: csrf.token }),
      },
      { DB: db }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('ISBN形式が不正です（10桁または13桁）')
  })

  it('POST /books registers book with metadata from openBD', async () => {
    const db = createMockDb()
    mockOpenBdFound('吾輩は猫である', '夏目漱石', '岩波書店')
    const csrf = await fetchCsrfContext()

    const res = await app.request(
      '/books',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: csrf.cookie,
        },
        body: new URLSearchParams({ isbn: '9784003101018', csrf_token: csrf.token }),
      },
      { DB: db }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('登録しました')
    expect(body).toContain('吾輩は猫である')
  })

  it('POST /books returns duplicate ISBN error for unique constraint violations', async () => {
    const db = createMockDb({
      initialBooks: [
        {
          id: 1,
          isbn: '9784003101018',
          title: null,
          author: null,
          publisher: null,
          created_at: '2026-04-13 09:00:00',
        },
      ],
      insertError: new Error('UNIQUE constraint failed: books.isbn'),
    })
    mockOpenBdNotFound()
    const csrf = await fetchCsrfContext()

    const res = await app.request(
      '/books',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: csrf.cookie,
        },
        body: new URLSearchParams({ isbn: '978-4003101018', csrf_token: csrf.token }),
      },
      { DB: db }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('この ISBN は既に登録されています: 9784003101018')
    expect(body).toContain('hx-swap-oob="innerHTML"')
  })
})
