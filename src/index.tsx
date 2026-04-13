import { Hono } from 'hono'
import { HomePage } from './templates/pages/home-page.js'
import { ResultMessage } from './templates/partials/result-message.js'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => {
  return c.html(<HomePage />)
})

app.post('/books', async (c) => {
  const form = await c.req.formData()
  const isbn = form.get('isbn')?.toString()

  if (!isbn) {
    return c.html(<ResultMessage message="ISBN required" />)
  }

  await c.env.DB.prepare('INSERT INTO books (isbn) VALUES (?)').bind(isbn).run()

  return c.html(<ResultMessage message={`登録: ${isbn}`} />)
})

export default app
