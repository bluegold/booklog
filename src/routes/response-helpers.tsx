import { BookListContent } from '../templates/partials/book-list.js'
import { ResultMessage } from '../templates/partials/result-message.js'
import type { ListBooksResult } from '../services/books-service.js'

export type ListContext = {
  query: string
  page: number
}

type BookListOobResponseOptions = {
  tone: 'success' | 'error'
  message: string
  listing: ListBooksResult
  csrfToken: string
  listOptions?: { highlightNewest?: boolean }
  extra?: unknown
}

export const pickListContext = (input: { query?: string | null | undefined; page?: string | null | undefined }): ListContext => {
  const query = input.query?.trim() ?? ''
  const page = Math.max(1, Number(input.page ?? '1') || 1)
  return { query, page }
}

// 書籍一覧コンテンツを描画する。
export const renderBookList = (
  listing: ListBooksResult,
  csrfToken: string,
  options: { highlightNewest?: boolean } = {}
) => {
  return (
    <BookListContent
      books={listing.books}
      query={listing.query}
      page={listing.page}
      totalCount={listing.totalCount}
      totalPages={listing.totalPages}
      csrfToken={csrfToken}
      {...(options.highlightNewest === true ? { highlightNewest: true } : {})}
    />
  )
}

// htmx の OOB swap で一覧領域だけ差し替える。
export const renderBookListOob = (
  listing: ListBooksResult,
  csrfToken: string,
  options: { highlightNewest?: boolean } = {}
) => {
  return (
    <div id="book-list" hx-swap-oob="innerHTML">
      {renderBookList(listing, csrfToken, options)}
    </div>
  )
}

// 処理失敗時はエラーメッセージと最新の一覧を返す。
export const renderErrorOobResponse = (message: string, listing: ListBooksResult, csrfToken: string) => {
  return renderBookListOobResponse({
    tone: 'error',
    message,
    listing,
    csrfToken,
  })
}

export const renderBookListOobResponse = (options: BookListOobResponseOptions) => {
  return (
    <>
      <ResultMessage message={options.message} tone={options.tone} />
      <div id="result-toast" hx-swap-oob="innerHTML">
        <div
          class="toast-notification relative rounded-xl border border-stone-200 bg-white p-2 pr-8 shadow-lg"
          style="pointer-events: auto;"
          onclick="(function(el){if(el.dataset.closing==='1')return;el.dataset.closing='1';el.classList.add('toast-notification-exit')})(this)"
          onanimationend="if(this.dataset.closing==='1'){this.remove()}"
        >
          <button
            type="button"
            aria-label="通知を閉じる"
            class="absolute right-2 top-2 rounded-md px-1.5 py-0.5 text-sm font-semibold text-stone-500 hover:bg-stone-100 hover:text-stone-700"
            onclick="event.stopPropagation();(function(btn){var el=btn.closest('.toast-notification');if(!el||el.dataset.closing==='1')return;el.dataset.closing='1';el.classList.add('toast-notification-exit')})(this)"
          >
            x
          </button>
          <ResultMessage message={options.message} tone={options.tone} />
        </div>
      </div>
      {options.extra}
      {renderBookListOob(options.listing, options.csrfToken, options.listOptions)}
    </>
  )
}
