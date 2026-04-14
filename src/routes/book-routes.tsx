import type { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'
import { csrfValidation } from '../middleware/csrf.js'
import { getCsrfTokenFromRequest } from '../security/csrf.js'
import { addBookByIsbn, addBookManual, deleteBookWithManagedCoverCleanup, getBookForEdit, listBooks, updateBookFields } from '../services/books-service.js'
import { isManagedCoverUrlForBook } from '../services/cover-url-utils.js'
import { ResultMessage } from '../templates/partials/result-message.js'
import { BookInlineEditForm } from '../templates/partials/book-inline-edit-form.js'
import { ManualBookEntryForm } from '../templates/partials/manual-book-entry-form.js'
import type { AppEnv } from '../types.js'
import {
  pickListContext,
  renderBookList,
  renderBookListOobResponse,
} from './response-helpers.js'

// ISBN 登録成功時は入力欄をクリアし、新規行付き一覧を返す。
const renderSuccessOobResponse = (message: string, listing: Awaited<ReturnType<typeof listBooks>>, csrfToken: string) => {
  return renderBookListOobResponse({
    tone: 'success',
    message,
    listing,
    csrfToken,
    listOptions: { highlightNewest: true },
    extra: (
      <input
        id="isbn-input"
        name="isbn"
        placeholder="例: 9784003101018"
        class="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-base outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
        hx-swap-oob="outerHTML"
      />
    ),
  })
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
    const authUserId = c.get('authUser')!.id
    const coverUrlReadonly = isManagedCoverUrlForBook(book.cover_url, c.env.BOOK_COVERS_PUBLIC_BASE_URL, authUserId, book.id)
    return c.html(<BookInlineEditForm csrfToken={csrfToken} book={book} context={context} coverUrlReadonly={coverUrlReadonly} />)
  })

  // ISBN を登録し、結果メッセージと更新後一覧を OOB で返す。
  app.post('/books', requireAuth, csrfValidation, async (c) => {
    const csrfToken = getCsrfTokenFromRequest(c.req.raw) ?? ''
    const result = await addBookByIsbn(c.env.DB, c.get('authUser')!.id, c.get('parsedForm').get('isbn')?.toString(), {
      debug: c.env.DEBUG === '1',
    })

    if (result.status === 'validation-error' || result.status === 'duplicate') {
      const listing = await listBooks(c.env.DB, c.get('authUser')!.id)
      return c.html(
        renderBookListOobResponse({
          tone: 'error',
          message: result.message,
          listing,
          csrfToken,
        })
      )
    }

    if (result.status === 'not-found') {
      return c.html(
        <>
          <ResultMessage message={result.message} tone="error" />
          <ManualBookEntryForm csrfToken={csrfToken} isbn={result.isbn} />
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
      return c.html(
        renderBookListOobResponse({
          tone: 'error',
          message: result.message,
          listing,
          csrfToken,
        })
      )
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
      return c.html(
        renderBookListOobResponse({
          tone: 'error',
          message: '対象の本が見つかりませんでした。',
          listing,
          csrfToken,
        })
      )
    }

    const result = await updateBookFields(c.env.DB, c.get('authUser')!.id, bookId, {
      title: form.get('title')?.toString(),
      author: form.get('author')?.toString(),
      publisher: form.get('publisher')?.toString(),
      published_at: form.get('published_at')?.toString(),
      cover_url: form.get('cover_url')?.toString(),
    }, {
      managedCoverBaseUrl: c.env.BOOK_COVERS_PUBLIC_BASE_URL,
    })

    const listing = await listBooks(c.env.DB, c.get('authUser')!.id, context)
    if (result.status !== 'success') {
      return c.html(
        renderBookListOobResponse({
          tone: 'error',
          message: result.message,
          listing,
          csrfToken,
        })
      )
    }

    return c.html(renderSuccessOobResponse(result.message, listing, csrfToken))
  })

  // 書籍を削除し、結果メッセージと更新後一覧を OOB で返す。
  app.post('/books/:id/delete', requireAuth, csrfValidation, async (c) => {
    const csrfToken = getCsrfTokenFromRequest(c.req.raw) ?? ''
    const bookId = Number(c.req.param('id'))
    const form = c.get('parsedForm')
    const context = pickListContext({ query: form.get('q')?.toString() ?? '', page: form.get('page')?.toString() ?? '1' })

    if (!Number.isFinite(bookId)) {
      const listing = await listBooks(c.env.DB, c.get('authUser')!.id, context)
      return c.html(
        renderBookListOobResponse({
          tone: 'error',
          message: '対象の本が見つかりませんでした。',
          listing,
          csrfToken,
        })
      )
    }

    const result = await deleteBookWithManagedCoverCleanup(
      c.env.DB,
      c.env.BOOK_COVERS,
      c.env.BOOK_COVERS_PUBLIC_BASE_URL,
      c.get('authUser')!.id,
      bookId
    )
    const listing = await listBooks(c.env.DB, c.get('authUser')!.id, context)

    if (result.status === 'not-found') {
      return c.html(
        renderBookListOobResponse({
          tone: 'error',
          message: result.message,
          listing,
          csrfToken,
        })
      )
    }

    return c.html(renderSuccessOobResponse(result.message, listing, csrfToken))
  })
}
