import type { BookRow, MockDbState } from './mock-db-types.js'

const filterBooks = (books: BookRow[], targetUserId: number, query: string): BookRow[] => {
  const normalizedQuery = query.trim().toLowerCase()
  const filtered = books.filter((book) => {
    if (book.user_id !== targetUserId) {
      return false
    }

    if (normalizedQuery.length === 0) {
      return true
    }

    const fields = [book.isbn, book.title, book.author, book.publisher]
    return fields.some((value) => (value ?? '').toLowerCase().includes(normalizedQuery))
  })

  return filtered.sort((a, b) => {
    const timeA = new Date((a.created_at ?? '').replace(' ', 'T') + 'Z').getTime()
    const timeB = new Date((b.created_at ?? '').replace(' ', 'T') + 'Z').getTime()
    if (timeA !== timeB) {
      return timeB - timeA
    }

    return b.id - a.id
  })
}

export const handleBooksRun = (sql: string, boundParams: unknown[], state: MockDbState) => {
  if (sql.startsWith('UPDATE books SET cover_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ?')) {
    if (state.options.forceCoverUpdateNoChange === true) {
      return { success: true, meta: { changes: 0 } }
    }

    const bookId = Number(boundParams[1] ?? 0)
    const userId = Number(boundParams[2] ?? 0)
    const expectedCoverUrl = boundParams[3] != null ? String(boundParams[3]) : null
    const target = state.books.find((book) => book.id === bookId && book.user_id === userId)
    if (!target) {
      return { success: true, meta: { changes: 0 } }
    }

    const currentCoverUrl = target.cover_url ?? null
    if (currentCoverUrl !== expectedCoverUrl) {
      return { success: true, meta: { changes: 0 } }
    }

    target.cover_url = boundParams[0] != null ? String(boundParams[0]) : null
    target.updated_at = '2026-04-14 10:00:00'
    return { success: true, meta: { changes: 1 } }
  }

  if (sql.startsWith('UPDATE books SET')) {
    const bookId = Number(boundParams[5] ?? 0)
    const userId = Number(boundParams[6] ?? 0)
    const expectedCoverUrl = boundParams[7] != null ? String(boundParams[7]) : null
    const target = state.books.find((book) => book.id === bookId && book.user_id === userId)
    if (!target) {
      return { success: true, meta: { changes: 0 } }
    }

    if (state.options.simulateConcurrentCoverUploadOnNextEditUpdate && !state.didSimulateConcurrentCoverUploadOnEditUpdate) {
      target.cover_url = state.options.simulateConcurrentCoverUploadOnNextEditUpdate
      state.didSimulateConcurrentCoverUploadOnEditUpdate = true
    }

    const currentCoverUrl = target.cover_url ?? null
    if (currentCoverUrl !== expectedCoverUrl) {
      return { success: true, meta: { changes: 0 } }
    }

    target.title = boundParams[0] != null ? String(boundParams[0]) : null
    target.author = boundParams[1] != null ? String(boundParams[1]) : null
    target.publisher = boundParams[2] != null ? String(boundParams[2]) : null
    target.published_at = boundParams[3] != null ? String(boundParams[3]) : null
    target.cover_url = boundParams[4] != null ? String(boundParams[4]) : null
    target.updated_at = '2026-04-14 10:00:00'
    return { success: true, meta: { changes: 1 } }
  }

  if (sql.startsWith('DELETE FROM books WHERE id = ? AND user_id = ?')) {
    const bookId = Number(boundParams[0] ?? 0)
    const userId = Number(boundParams[1] ?? 0)
    const index = state.books.findIndex((book) => book.id === bookId && book.user_id === userId)
    if (index < 0) {
      return { success: true, meta: { changes: 0 } }
    }

    state.books.splice(index, 1)
    return { success: true, meta: { changes: 1 } }
  }

  if (!sql.startsWith('INSERT INTO books')) {
    return { success: true, meta: { changes: 0 } }
  }

  if (state.options.insertError) {
    throw state.options.insertError
  }

  const user_id = Number(boundParams[0] ?? 0)
  const isbn = String(boundParams[1] ?? '')
  const title = boundParams[2] != null ? String(boundParams[2]) : null
  const author = boundParams[3] != null ? String(boundParams[3]) : null
  const publisher = boundParams[4] != null ? String(boundParams[4]) : null
  const published_at = boundParams[5] != null ? String(boundParams[5]) : null
  const cover_url = boundParams[6] != null ? String(boundParams[6]) : null
  state.books.unshift({
    id: state.nextBookId,
    user_id,
    isbn,
    title,
    author,
    publisher,
    published_at,
    cover_url,
    created_at: '2026-04-13 10:00:00',
    updated_at: '2026-04-13 10:00:00',
  })
  state.nextBookId += 1

  return { success: true, meta: { changes: 1 } }
}

export const handleBooksAll = <T>(sql: string, boundParams: unknown[], state: MockDbState) => {
  if (sql.startsWith('SELECT COUNT(*) AS total_count FROM books WHERE user_id = ?')) {
    const targetUserId = Number(boundParams[0] ?? 0)
    const query = String(boundParams[1] ?? '')
    const total_count = filterBooks(state.books, targetUserId, query).length
    return { results: [{ total_count }] as T[] }
  }

  if (sql.startsWith('SELECT id, user_id, isbn, title, author, publisher, published_at, cover_url, created_at, updated_at FROM books WHERE user_id = ?')) {
    const targetUserId = Number(boundParams[0] ?? 0)
    const query = String(boundParams[1] ?? '')
    const limit = Number(boundParams[6] ?? 10)
    const offset = Number(boundParams[7] ?? 0)
    const filtered = filterBooks(state.books, targetUserId, query)
    return { results: filtered.slice(offset, offset + limit) as T[] }
  }

  return { results: [] as T[] }
}

export const handleBooksFirst = <T>(sql: string, boundParams: unknown[], state: MockDbState) => {
  if (sql.startsWith('SELECT id, user_id, isbn, title, author, publisher, published_at, cover_url, created_at, updated_at FROM books WHERE id = ? AND user_id = ? LIMIT 1')) {
    const bookId = Number(boundParams[0] ?? 0)
    const userId = Number(boundParams[1] ?? 0)
    const row = state.books.find((book) => book.id === bookId && book.user_id === userId)
    return (row ?? null) as T | null
  }

  return null
}
