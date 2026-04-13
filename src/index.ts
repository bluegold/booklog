import { Hono } from 'hono'

type Bindings = {
  DB: D1Database
}

const app = new Hono<{ Bindings: Bindings }>()

app.get('/', (c) => {
  return c.html(`
    <html>
      <head>
        <script src="https://unpkg.com/htmx.org@1.9.12"></script>
      </head>
      <body>
        <h1>Reading Log</h1>

        <form hx-post="/books" hx-target="#result" hx-swap="innerHTML">
          <input name="isbn" placeholder="ISBN" />
          <button type="submit">登録</button>
        </form>

        <div id="result"></div>
      </body>
    </html>
  `)
})

app.post('/books', async (c) => {
  const form = await c.req.formData()
  const isbn = form.get('isbn')?.toString()

  if (!isbn) {
    return c.html('<p>ISBN required</p>')
  }

  await c.env.DB
    .prepare('INSERT INTO books (isbn) VALUES (?)')
    .bind(isbn)
    .run()

  return c.html(`<p>登録: ${isbn}</p>`)
})

export default app
