import { beforeEach, describe, expect, it, vi } from 'vitest'
import app from './index.js'
import { createSessionToken } from './security/session.js'

type BookRow = {
  id: number
  user_id: number
  isbn: string | null
  title: string | null
  author: string | null
  publisher: string | null
  published_at: string | null
  cover_url: string | null
  created_at: string | null
}

type MockDbOptions = {
  initialBooks?: BookRow[]
  insertError?: Error
}

type CsrfContext = {
  token: string
  csrfCookie: string
  sessionCookie: string
}

const TEST_SESSION_SECRET = 'test-session-secret'

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

          const user_id = Number(boundParams[0] ?? 0)
          const isbn = String(boundParams[1] ?? '')
          const title = boundParams[2] != null ? String(boundParams[2]) : null
          const author = boundParams[3] != null ? String(boundParams[3]) : null
          const publisher = boundParams[4] != null ? String(boundParams[4]) : null
          const published_at = boundParams[5] != null ? String(boundParams[5]) : null
          const cover_url = boundParams[6] != null ? String(boundParams[6]) : null
          books.unshift({
            id: nextId,
            user_id,
            isbn,
            title,
            author,
            publisher,
            published_at,
            cover_url,
            created_at: '2026-04-13 10:00:00',
          })
          nextId += 1

          return { success: true }
        },
        async all<T>() {
          if (sql.startsWith('SELECT id, user_id, isbn, title, author, publisher, published_at, cover_url, created_at FROM books WHERE user_id = ?')) {
            const targetUserId = Number(boundParams[0] ?? 0)
            return { results: books.filter((book) => book.user_id === targetUserId) as T[] }
          }

          return { results: [] as T[] }
        },
      }
    },
  } as unknown as D1Database
}

const createSessionCookie = async (): Promise<string> => {
  const token = await createSessionToken(TEST_SESSION_SECRET, {
    id: 1,
    email: 'tester@example.com',
    name: 'Tester',
  })

  return `session_token=${token}`
}

const fetchCsrfContext = async (): Promise<CsrfContext> => {
  const sessionCookie = await createSessionCookie()
  const res = await app.request(
    '/',
    {
      headers: {
        Cookie: sessionCookie,
      },
    },
    { SESSION_SECRET: TEST_SESSION_SECRET }
  )
  const body = await res.text()

  const tokenMatch = body.match(/name="csrf_token" value="([^"]+)"/)
  const cookieHeader = res.headers.get('set-cookie')

  const token = tokenMatch?.[1]
  const csrfCookie = cookieHeader?.split(';')[0]

  if (!token || !csrfCookie) {
    throw new Error('CSRF context was not issued')
  }

  return {
    token,
    csrfCookie,
    sessionCookie,
  }
}

type OpenBdResponse = Array<
  { summary?: { title?: string; author?: string; publisher?: string; pubdate?: string; cover?: string } } | null
>

const mockOpenBdFound = (
  title: string,
  author = '著者テスト',
  publisher = '出版社テスト',
  pubdate = '198801',
  cover = 'https://example.com/cover.jpg'
): void => {
  const body: OpenBdResponse = [{ summary: { title, author, publisher, pubdate, cover } }]
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
    expect(body).not.toContain('hx-post="/books"')
    expect(body).not.toContain('hx-get="/books"')
    expect(body).not.toContain('name="csrf_token"')
    expect(body).toContain('Googleでログイン')
    expect(res.headers.get('set-cookie')).toContain('csrf_token=')
  })

  it('GET /books returns 401 when not authenticated', async () => {
    const db = createMockDb()
    const res = await app.request('/books', undefined, { DB: db })
    const body = await res.text()

    expect(res.status).toBe(401)
    expect(body).toContain('ログインが必要です。')
  })

  it('GET /books returns empty-state message when authenticated and no books exist', async () => {
    const db = createMockDb()
    const sessionCookie = await createSessionCookie()
    const res = await app.request(
      '/books',
      {
        headers: {
          Cookie: sessionCookie,
        },
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('まだ登録がありません。')
  })

  it('POST /books rejects request when not authenticated', async () => {
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
    expect(res.status).toBe(401)
    expect(body).toContain('ログインが必要です。')
  })

  it('POST /books rejects request when CSRF token is missing', async () => {
    const db = createMockDb()
    const sessionCookie = await createSessionCookie()

    const res = await app.request(
      '/books',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: sessionCookie,
        },
        body: new URLSearchParams({ isbn: '9784003101018' }),
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
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
          Cookie: `${csrf.sessionCookie}; ${csrf.csrfCookie}`,
        },
        body: new URLSearchParams({ isbn: 'abc', csrf_token: csrf.token }),
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('ISBN形式が不正です（10桁または13桁）')
  })

  it('POST /books registers book with metadata from openBD', async () => {
    const db = createMockDb()
    mockOpenBdFound('吾輩は猫である', '夏目漱石', '岩波書店', '1905-11', 'https://example.com/wagahai.jpg')
    const csrf = await fetchCsrfContext()

    const res = await app.request(
      '/books',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: `${csrf.sessionCookie}; ${csrf.csrfCookie}`,
        },
        body: new URLSearchParams({ isbn: '9784003101018', csrf_token: csrf.token }),
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('登録しました')
    expect(body).toContain('吾輩は猫である')
    expect(body).toContain('出版日: 1905-11')
    expect(body).toContain('https://example.com/wagahai.jpg')
  })

  it('POST /books returns duplicate ISBN error for unique constraint violations', async () => {
    const db = createMockDb({
      initialBooks: [
        {
          id: 1,
          user_id: 1,
          isbn: '9784003101018',
          title: null,
          author: null,
          publisher: null,
          published_at: null,
          cover_url: null,
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
          Cookie: `${csrf.sessionCookie}; ${csrf.csrfCookie}`,
        },
        body: new URLSearchParams({ isbn: '978-4003101018', csrf_token: csrf.token }),
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('この ISBN は既に登録されています: 9784003101018')
    expect(body).toContain('hx-swap-oob="innerHTML"')
  })
})
