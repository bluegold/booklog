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

export const insertBookByIsbn = async (db: D1Database, isbn: string): Promise<void> => {
  await db.prepare('INSERT INTO books (isbn) VALUES (?)').bind(isbn).run()
}
