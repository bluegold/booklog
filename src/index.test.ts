import { describe, expect, it } from 'vitest'
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
          books.unshift({
            id: nextId,
            isbn,
            title: null,
            author: null,
            publisher: null,
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

describe('reading log routes', () => {
  it('GET / returns top page with form and list container', async () => {
    const res = await app.request('/')
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('Reading Log')
    expect(body).toContain('hx-post="/books"')
    expect(body).toContain('hx-get="/books"')
  })

  it('GET /books returns empty-state message when no books exist', async () => {
    const db = createMockDb()
    const res = await app.request('/books', undefined, { DB: db })
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('まだ登録がありません。')
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

    expect(res.status).toBe(200)
    expect(body).toContain('この ISBN は既に登録されています: 9784003101018')
    expect(body).toContain('hx-swap-oob="innerHTML"')
  })
})
