export type BookRow = {
  id: number
  isbn: string | null
  title: string | null
  author: string | null
  publisher: string | null
  created_at: string | null
}

export const fetchBooks = async (db: D1Database): Promise<BookRow[]> => {
  const result = await db
    .prepare(
      'SELECT id, isbn, title, author, publisher, created_at FROM books ORDER BY created_at DESC, id DESC LIMIT 50'
    )
    .all<BookRow>()

  return result.results ?? []
}

export type InsertBookParams = {
  isbn: string
  title?: string | undefined
  author?: string | undefined
  publisher?: string | undefined
}

export const insertBook = async (db: D1Database, params: InsertBookParams): Promise<void> => {
  await db
    .prepare('INSERT INTO books (isbn, title, author, publisher) VALUES (?, ?, ?, ?)')
    .bind(params.isbn, params.title ?? null, params.author ?? null, params.publisher ?? null)
    .run()
}
