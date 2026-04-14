export type BookRow = {
  id: number
  user_id: number
  isbn: string | null
  title: string | null
  author: string | null
  publisher: string | null
  published_at: string | null
  cover_url: string | null
  created_at: string | null
  updated_at: string | null
}

const buildSearchPattern = (query: string): string => `%${query}%`

export const fetchBooksPage = async (
  db: D1Database,
  userId: number,
  query: string,
  limit: number,
  offset: number
): Promise<BookRow[]> => {
  const pattern = buildSearchPattern(query)
  const result = await db
    .prepare(
      'SELECT id, user_id, isbn, title, author, publisher, published_at, cover_url, created_at, updated_at FROM books WHERE user_id = ? AND (? = "" OR LOWER(IFNULL(isbn, "")) LIKE ? OR LOWER(IFNULL(title, "")) LIKE ? OR LOWER(IFNULL(author, "")) LIKE ? OR LOWER(IFNULL(publisher, "")) LIKE ?) ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?'
    )
    .bind(userId, query, pattern, pattern, pattern, pattern, limit, offset)
    .all<BookRow>()

  return result.results ?? []
}

export const countBooks = async (db: D1Database, userId: number, query: string): Promise<number> => {
  const pattern = buildSearchPattern(query)
  const result = await db
    .prepare(
      'SELECT COUNT(*) AS total_count FROM books WHERE user_id = ? AND (? = "" OR LOWER(IFNULL(isbn, "")) LIKE ? OR LOWER(IFNULL(title, "")) LIKE ? OR LOWER(IFNULL(author, "")) LIKE ? OR LOWER(IFNULL(publisher, "")) LIKE ?)'
    )
    .bind(userId, query, pattern, pattern, pattern, pattern)
    .all<{ total_count: number }>()

  const rawCount = result.results?.[0]?.total_count ?? 0
  return Number(rawCount)
}

export type InsertBookParams = {
  user_id: number
  isbn: string
  title?: string | undefined
  author?: string | undefined
  publisher?: string | undefined
  published_at?: string | undefined
  cover_url?: string | undefined
}

export const insertBook = async (db: D1Database, params: InsertBookParams): Promise<void> => {
  await db
    .prepare(
      'INSERT INTO books (user_id, isbn, title, author, publisher, published_at, cover_url, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)'
    )
    .bind(
      params.user_id,
      params.isbn,
      params.title ?? null,
      params.author ?? null,
      params.publisher ?? null,
      params.published_at ?? null,
      params.cover_url ?? null
    )
    .run()
}

export type EditableBookFields = {
  title?: string | undefined
  author?: string | undefined
  publisher?: string | undefined
  published_at?: string | undefined
  cover_url?: string | undefined
}

export const fetchBookByIdForUser = async (db: D1Database, userId: number, bookId: number): Promise<BookRow | null> => {
  const result = await db
    .prepare(
      'SELECT id, user_id, isbn, title, author, publisher, published_at, cover_url, created_at, updated_at FROM books WHERE id = ? AND user_id = ? LIMIT 1'
    )
    .bind(bookId, userId)
    .first<BookRow>()

  return result ?? null
}

export const updateBookByIdForUser = async (
  db: D1Database,
  userId: number,
  bookId: number,
  expectedCoverUrl: string | null,
  fields: EditableBookFields
): Promise<boolean> => {
  const result = await db
    .prepare(
      'UPDATE books SET title = ?, author = ?, publisher = ?, published_at = ?, cover_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND ((cover_url IS NULL AND ? IS NULL) OR cover_url = ?)'
    )
    .bind(
      fields.title ?? null,
      fields.author ?? null,
      fields.publisher ?? null,
      fields.published_at ?? null,
      fields.cover_url ?? null,
      bookId,
      userId,
      expectedCoverUrl,
      expectedCoverUrl
    )
    .run<{ changes?: number }>()

  return (result.meta?.changes ?? 0) > 0
}

export const updateBookCoverUrlByIdForUser = async (
  db: D1Database,
  userId: number,
  bookId: number,
  currentCoverUrl: string | null,
  coverUrl: string
): Promise<boolean> => {
  const result = await db
    .prepare(
      'UPDATE books SET cover_url = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND user_id = ? AND ((cover_url IS NULL AND ? IS NULL) OR cover_url = ?)'
    )
    .bind(coverUrl, bookId, userId, currentCoverUrl, currentCoverUrl)
    .run<{ changes?: number }>()

  return (result.meta?.changes ?? 0) > 0
}

export const deleteBookByIdForUser = async (db: D1Database, userId: number, bookId: number): Promise<boolean> => {
  const result = await db.prepare('DELETE FROM books WHERE id = ? AND user_id = ?').bind(bookId, userId).run<{ changes?: number }>()
  return (result.meta?.changes ?? 0) > 0
}
