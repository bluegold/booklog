import { Hono } from 'hono'
import { HomePage } from './templates/pages/home-page.js'
import { BookListContent } from './templates/partials/book-list.js'
import { ResultMessage } from './templates/partials/result-message.js'

type Bindings = {
  DB: D1Database
}

type BookRow = {
  id: number
  isbn: string | null
  title: string | null
  author: string | null
  publisher: string | null
  created_at: string | null
}

const app = new Hono<{ Bindings: Bindings }>()

const fetchBooks = async (db: D1Database): Promise<BookRow[]> => {
  const result = await db
    .prepare(
      'SELECT id, isbn, title, author, publisher, created_at FROM books ORDER BY created_at DESC, id DESC LIMIT 50'
    )
    .all<BookRow>()

  return result.results ?? []
}

app.get('/', (c) => {
  return c.html(<HomePage />)
})

app.get('/books', async (c) => {
  const books = await fetchBooks(c.env.DB)
  return c.html(<BookListContent books={books} />)
})

app.post('/books', async (c) => {
  const form = await c.req.formData()
  const isbn = form.get('isbn')?.toString().trim()

  if (!isbn) {
    return c.html(<ResultMessage message="ISBN required" tone="error" />)
  }

  try {
    await c.env.DB.prepare('INSERT INTO books (isbn) VALUES (?)').bind(isbn).run()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (message.includes('UNIQUE constraint failed: books.isbn')) {
      const books = await fetchBooks(c.env.DB)
      return c.html(
        <>
          <ResultMessage message={`この ISBN は既に登録されています: ${isbn}`} tone="error" />
          <div id="book-list" hx-swap-oob="innerHTML">
            <BookListContent books={books} />
          </div>
        </>
      )
    }

    throw error
  }

  const books = await fetchBooks(c.env.DB)

  return c.html(
    <>
      <ResultMessage message={`登録: ${isbn}`} tone="success" />
      <div id="book-list" hx-swap-oob="innerHTML">
        <BookListContent books={books} />
      </div>
    </>
  )
})

export default app
