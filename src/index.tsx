import { Hono } from 'hono'
import type { AppEnv } from './types.js'
import { addBookByIsbn, listBooks } from './services/books-service.js'
import { csrfIssuance, csrfValidation } from './middleware/csrf.js'
import { HomePage } from './templates/pages/home-page.js'
import { BookListContent } from './templates/partials/book-list.js'
import { ResultMessage } from './templates/partials/result-message.js'

const app = new Hono<AppEnv>()

app.get('/', csrfIssuance, (c) => {
  return c.html(<HomePage csrfToken={c.get('csrfToken')} />)
})

app.get('/books', async (c) => {
  const books = await listBooks(c.env.DB)
  return c.html(<BookListContent books={books} />)
})

app.post('/books', csrfValidation, async (c) => {
  const result = await addBookByIsbn(c.env.DB, c.get('parsedForm').get('isbn')?.toString(), {
    debugOpenBd: c.env.DEBUG_OPENBD === '1',
  })

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
