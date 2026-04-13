import { Hono } from 'hono'
import { addBookByIsbn, listBooks } from './services/books-service.js'
import { HomePage } from './templates/pages/home-page.js'
import { BookListContent } from './templates/partials/book-list.js'
import { ResultMessage } from './templates/partials/result-message.js'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => {
  return c.html(<HomePage />)
})

app.get('/books', async (c) => {
  const books = await listBooks(c.env.DB)
  return c.html(<BookListContent books={books} />)
})

app.post('/books', async (c) => {
  const form = await c.req.formData()
  const result = await addBookByIsbn(c.env.DB, form.get('isbn')?.toString())

  if (result.status === 'validation-error' || result.status === 'duplicate') {
    return c.html(
      <>
        <ResultMessage message={result.message} tone="error" />
        <div id="book-list" hx-swap-oob="innerHTML">
          <BookListContent books={result.books} />
        </div>
      </>
    )
  }

  return c.html(
    <>
      <ResultMessage message={result.message} tone="success" />
      <div id="book-list" hx-swap-oob="innerHTML">
        <BookListContent books={result.books} />
      </div>
    </>
  )
})

export default app
