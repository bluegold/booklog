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
}

export const fetchBooks = async (db: D1Database, userId: number): Promise<BookRow[]> => {
  const result = await db
    .prepare(
      'SELECT id, user_id, isbn, title, author, publisher, published_at, cover_url, created_at FROM books WHERE user_id = ? ORDER BY created_at DESC, id DESC LIMIT 50'
    )
    .bind(userId)
    .all<BookRow>()

  return result.results ?? []
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
    .prepare('INSERT INTO books (user_id, isbn, title, author, publisher, published_at, cover_url) VALUES (?, ?, ?, ?, ?, ?, ?)')
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
