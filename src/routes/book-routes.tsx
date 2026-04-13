import type { Hono } from 'hono'
import { requireAuth } from '../middleware/auth.js'
import { csrfValidation } from '../middleware/csrf.js'
import { addBookByIsbn, listBooks } from '../services/books-service.js'
import { BookListContent } from '../templates/partials/book-list.js'
import { ResultMessage } from '../templates/partials/result-message.js'
import type { AppEnv } from '../types.js'

// 一覧描画に必要な props をサービス戻り値から組み立てる。
const renderBookList = (
  books: Awaited<ReturnType<typeof listBooks>>,
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
      {...(options.highlightNewest === true ? { highlightNewest: true } : {})}
    />
  )
}

// htmx の OOB swap で一覧領域だけ差し替える。
const renderBookListOob = (listing: Awaited<ReturnType<typeof listBooks>>, options: { highlightNewest?: boolean } = {}) => {
  return (
    <div id="book-list" hx-swap-oob="innerHTML">
      {renderBookList(listing, options)}
    </div>
  )
}

// 登録失敗時はメッセージと最新一覧を返す。
const renderErrorOobResponse = (message: string, listing: Awaited<ReturnType<typeof listBooks>>) => {
  return (
    <>
      <ResultMessage message={message} tone="error" />
      {renderBookListOob(listing)}
    </>
  )
}

// 登録成功時は入力欄をクリアし、新規行付き一覧を返す。
const renderSuccessOobResponse = (message: string, listing: Awaited<ReturnType<typeof listBooks>>) => {
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
      {renderBookListOob(listing, { highlightNewest: true })}
    </>
  )
}

export const registerBookRoutes = (app: Hono<AppEnv>): void => {
  // 検索条件とページ番号を受け取って一覧を返す。
  app.get('/books', requireAuth, async (c) => {
    const query = c.req.query('q') ?? ''
    const pageValue = Number(c.req.query('page') ?? '1')
    const listing = await listBooks(c.env.DB, c.get('authUser')!.id, {
      query,
      page: pageValue,
    })

    return c.html(renderBookList(listing))
  })

  // ISBN を登録し、結果メッセージと更新後一覧を OOB で返す。
  app.post('/books', requireAuth, csrfValidation, async (c) => {
    const result = await addBookByIsbn(c.env.DB, c.get('authUser')!.id, c.get('parsedForm').get('isbn')?.toString(), {
      debug: c.env.DEBUG === '1',
    })

    if (result.status === 'validation-error' || result.status === 'duplicate') {
      const listing = await listBooks(c.env.DB, c.get('authUser')!.id)
      return c.html(renderErrorOobResponse(result.message, listing))
    }

    const listing = await listBooks(c.env.DB, c.get('authUser')!.id)
    return c.html(renderSuccessOobResponse(result.message, listing))
  })
}
