import { BookListContent } from '../templates/partials/book-list.js'
import { ResultMessage } from '../templates/partials/result-message.js'
import type { ListBooksResult } from '../services/books-service.js'

export type ListContext = {
  query: string
  page: number
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
  return (
    <>
      <ResultMessage message={message} tone="error" />
      {renderBookListOob(listing, csrfToken)}
    </>
  )
}
