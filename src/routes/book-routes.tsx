import type { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'
import { csrfValidation } from '../middleware/csrf.js'
import { getCsrfTokenFromRequest } from '../security/csrf.js'
import { addBookByIsbn, addBookManual, deleteBook, getBookForEdit, listBooks, updateBookFields } from '../services/books-service.js'
import { BookListContent } from '../templates/partials/book-list.js'
import { BookMetadataFields } from '../templates/partials/book-metadata-fields.js'
import { ResultMessage } from '../templates/partials/result-message.js'
import type { AppEnv } from '../types.js'

type ListContext = {
  query: string
  page: number
}

const pickListContext = (input: { query?: string | null | undefined; page?: string | null | undefined }): ListContext => {
  const query = input.query?.trim() ?? ''
  const page = Math.max(1, Number(input.page ?? '1') || 1)
  return { query, page }
}

// 一覧描画に必要な props をサービス戻り値から組み立てる。
const renderBookList = (
  books: Awaited<ReturnType<typeof listBooks>>,
  csrfToken: string,
  options: {
    highlightNewest?: boolean
  } = {}
) => {
  return (
    <BookListContent
      books={books.books}
      query={books.query}
      page={books.page}
      totalCount={books.totalCount}
      totalPages={books.totalPages}
      csrfToken={csrfToken}
      {...(options.highlightNewest === true ? { highlightNewest: true } : {})}
    />
  )
}

// htmx の OOB swap で一覧領域だけ差し替える。
const renderBookListOob = (
  listing: Awaited<ReturnType<typeof listBooks>>,
  csrfToken: string,
  options: { highlightNewest?: boolean } = {}
) => {
  return (
    <div id="book-list" hx-swap-oob="innerHTML">
      {renderBookList(listing, csrfToken, options)}
    </div>
  )
}

// 登録失敗時はメッセージと最新一覧を返す。
const renderErrorOobResponse = (message: string, listing: Awaited<ReturnType<typeof listBooks>>, csrfToken: string) => {
  return (
    <>
      <ResultMessage message={message} tone="error" />
      {renderBookListOob(listing, csrfToken)}
    </>
  )
}

// 登録成功時は入力欄をクリアし、新規行付き一覧を返す。
const renderSuccessOobResponse = (message: string, listing: Awaited<ReturnType<typeof listBooks>>, csrfToken: string) => {
  return (
    <>
      <ResultMessage message={message} tone="success" />
      <input
        id="isbn-input"
        name="isbn"
        placeholder="例: 9784003101018"
        class="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-base outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
        hx-swap-oob="outerHTML"
      />
      {renderBookListOob(listing, csrfToken, { highlightNewest: true })}
    </>
  )
}

const renderManualEntryForm = (csrfToken: string, isbn: string) => {
  return (
    <div class="inline-form-enter rounded-xl border border-amber-300 bg-amber-50 p-4">
      <p class="mb-2 text-sm font-semibold text-amber-900">ISBN {isbn} を手入力で登録</p>
      <form hx-post="/books/manual" hx-target="#result" hx-swap="innerHTML" class="space-y-3">
        <input type="hidden" name="csrf_token" value={csrfToken} />
        <label class="text-xs text-stone-600">
          ISBN
          <input
            type="text"
            name="isbn"
            value={isbn}
            readonly
            class="mt-1 w-full rounded-lg border border-stone-300 bg-stone-100 px-3 py-2 text-sm text-stone-700"
          />
        </label>
        <BookMetadataFields />
        <div class="flex items-center justify-end gap-2">
          <button
            type="button"
            class="rounded-lg border border-stone-300 bg-white px-4 py-2 text-sm font-medium text-stone-700 transition hover:bg-stone-100"
            onclick="document.getElementById('result').innerHTML=''"
          >
            キャンセル
          </button>
          <button
            type="submit"
            class="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-800"
          >
            手入力で登録
          </button>
        </div>
      </form>
    </div>
  )
}

const renderInlineEditForm = (
  csrfToken: string,
  book: NonNullable<Awaited<ReturnType<typeof getBookForEdit>>>,
  context: ListContext
) => {
  return (
    <form
      hx-post={`/books/${book.id}/edit`}
      hx-target="#result"
      hx-swap="innerHTML"
      class="inline-form-enter rounded-lg border border-stone-200 bg-stone-50 p-3"
    >
      <input type="hidden" name="csrf_token" value={csrfToken} />
      <input type="hidden" name="q" value={context.query} />
      <input type="hidden" name="page" value={String(context.page)} />
      <div class="mb-2 text-xs text-stone-600">ISBN: {book.isbn ?? '-'}</div>
      <BookMetadataFields
        title={book.title}
        author={book.author}
        publisher={book.publisher}
        publishedAt={book.published_at}
        coverUrl={book.cover_url}
      />
      <div class="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          class="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-100"
          onclick={`document.getElementById('book-edit-${book.id}').innerHTML=''`}
        >
          キャンセル
        </button>
        <button type="submit" class="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-800">
          保存
        </button>
      </div>
    </form>
  )
}

export const registerBookRoutes = (app: Hono<AppEnv>): void => {
  // 検索条件とページ番号を受け取って一覧を返す。
  app.get('/books', requireAuth, async (c) => {
    const context = pickListContext({ query: c.req.query('q'), page: c.req.query('page') })
    const csrfToken = getCsrfTokenFromRequest(c.req.raw) ?? ''
    const listing = await listBooks(c.env.DB, c.get('authUser')!.id, {
      query: context.query,
      page: context.page,
    })

    return c.html(renderBookList(listing, csrfToken))
  })

  app.get('/books/:id/edit', requireAuth, async (c) => {
    const bookId = Number(c.req.param('id'))
    const context = pickListContext({ query: c.req.query('q'), page: c.req.query('page') })

    if (!Number.isFinite(bookId)) {
      return c.html(<ResultMessage message="対象の本が見つかりませんでした。" tone="error" />, 404)
    }

    const book = await getBookForEdit(c.env.DB, c.get('authUser')!.id, bookId)
    if (!book) {
      return c.html(<ResultMessage message="対象の本が見つかりませんでした。" tone="error" />, 404)
    }

    const csrfToken = getCsrfTokenFromRequest(c.req.raw) ?? ''
    return c.html(renderInlineEditForm(csrfToken, book, context))
  })

  // ISBN を登録し、結果メッセージと更新後一覧を OOB で返す。
  app.post('/books', requireAuth, csrfValidation, async (c) => {
    const csrfToken = getCsrfTokenFromRequest(c.req.raw) ?? ''
    const result = await addBookByIsbn(c.env.DB, c.get('authUser')!.id, c.get('parsedForm').get('isbn')?.toString(), {
      debug: c.env.DEBUG === '1',
    })

    if (result.status === 'validation-error' || result.status === 'duplicate') {
      const listing = await listBooks(c.env.DB, c.get('authUser')!.id)
      return c.html(renderErrorOobResponse(result.message, listing, csrfToken))
    }

    if (result.status === 'not-found') {
      return c.html(
        <>
          <ResultMessage message={result.message} tone="error" />
          {renderManualEntryForm(csrfToken, result.isbn)}
        </>
      )
    }

    const listing = await listBooks(c.env.DB, c.get('authUser')!.id)
    return c.html(renderSuccessOobResponse(result.message, listing, csrfToken))
  })

  app.post('/books/manual', requireAuth, csrfValidation, async (c) => {
    const csrfToken = getCsrfTokenFromRequest(c.req.raw) ?? ''
    const form = c.get('parsedForm')
    const result = await addBookManual(c.env.DB, c.get('authUser')!.id, form.get('isbn')?.toString(), {
      title: form.get('title')?.toString(),
      author: form.get('author')?.toString(),
      publisher: form.get('publisher')?.toString(),
      published_at: form.get('published_at')?.toString(),
      cover_url: form.get('cover_url')?.toString(),
    })

    if (result.status === 'validation-error' || result.status === 'duplicate') {
      const listing = await listBooks(c.env.DB, c.get('authUser')!.id)
      return c.html(renderErrorOobResponse(result.message, listing, csrfToken))
    }

    const listing = await listBooks(c.env.DB, c.get('authUser')!.id)
    return c.html(renderSuccessOobResponse(result.message, listing, csrfToken))
  })

  app.post('/books/:id/edit', requireAuth, csrfValidation, async (c) => {
    const csrfToken = getCsrfTokenFromRequest(c.req.raw) ?? ''
    const bookId = Number(c.req.param('id'))
    const form = c.get('parsedForm')
    const context = pickListContext({ query: form.get('q')?.toString() ?? '', page: form.get('page')?.toString() ?? '1' })

    if (!Number.isFinite(bookId)) {
      const listing = await listBooks(c.env.DB, c.get('authUser')!.id, context)
      return c.html(renderErrorOobResponse('対象の本が見つかりませんでした。', listing, csrfToken))
    }

    const result = await updateBookFields(c.env.DB, c.get('authUser')!.id, bookId, {
      title: form.get('title')?.toString(),
      author: form.get('author')?.toString(),
      publisher: form.get('publisher')?.toString(),
      published_at: form.get('published_at')?.toString(),
      cover_url: form.get('cover_url')?.toString(),
    })

    const listing = await listBooks(c.env.DB, c.get('authUser')!.id, context)
    if (result.status === 'not-found') {
      return c.html(renderErrorOobResponse(result.message, listing, csrfToken))
    }

    return c.html(renderSuccessOobResponse(result.message, listing, csrfToken))
  })

  app.post('/books/:id/delete', requireAuth, csrfValidation, async (c) => {
    const csrfToken = getCsrfTokenFromRequest(c.req.raw) ?? ''
    const bookId = Number(c.req.param('id'))
    const form = c.get('parsedForm')
    const context = pickListContext({ query: form.get('q')?.toString() ?? '', page: form.get('page')?.toString() ?? '1' })

    if (!Number.isFinite(bookId)) {
      const listing = await listBooks(c.env.DB, c.get('authUser')!.id, context)
      return c.html(renderErrorOobResponse('対象の本が見つかりませんでした。', listing, csrfToken))
    }

    const result = await deleteBook(c.env.DB, c.get('authUser')!.id, bookId)
    const listing = await listBooks(c.env.DB, c.get('authUser')!.id, context)

    if (result.status === 'not-found') {
      return c.html(renderErrorOobResponse(result.message, listing, csrfToken))
    }

    return c.html(renderSuccessOobResponse(result.message, listing, csrfToken))
  })
}
