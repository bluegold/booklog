type BookRow = {
  id: number
  isbn: string | null
  title: string | null
  author: string | null
  publisher: string | null
  published_at: string | null
  cover_url: string | null
  created_at: string | null
}

type BookListContentProps = {
  books: BookRow[]
  query: string
  page: number
  totalCount: number
  totalPages: number
  csrfToken: string
  highlightNewest?: boolean
}

const NO_IMAGE_DATA_URL =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='96' height='128' viewBox='0 0 96 128'%3E%3Crect width='96' height='128' fill='%23f5f5f4'/%3E%3Crect x='1' y='1' width='94' height='126' fill='none' stroke='%23d6d3d1'/%3E%3Ctext x='48' y='66' text-anchor='middle' font-size='11' font-family='sans-serif' fill='%23787569'%3ENO IMAGE%3C/text%3E%3C/svg%3E"

const formatCreatedAt = (createdAt: string | null): string => {
  if (!createdAt) {
    return '-'
  }

  const normalized = createdAt.includes('T') ? createdAt : `${createdAt.replace(' ', 'T')}Z`
  const date = new Date(normalized)

  if (Number.isNaN(date.getTime())) {
    return createdAt
  }

  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export const BookListContent = (props: BookListContentProps) => {
  const buildPageUrl = (targetPage: number): string => {
    const params = new URLSearchParams()
    if (props.query.length > 0) {
      params.set('q', props.query)
    }
    params.set('page', String(targetPage))
    return `/books?${params.toString()}`
  }

  const hasPrev = props.page > 1
  const hasNext = props.page < props.totalPages
  const compactPagination =
    props.totalPages > 1 ? (
      <div class="flex items-center gap-1">
        <button
          type="button"
          aria-label="前のページ"
          class="rounded-md border border-stone-300 bg-white px-2 py-1 text-sm leading-none disabled:cursor-not-allowed disabled:opacity-40"
          hx-get={buildPageUrl(props.page - 1)}
          hx-target="#book-list"
          hx-swap="innerHTML"
          disabled={!hasPrev}
        >
          &lt;
        </button>
        <button
          type="button"
          aria-label="次のページ"
          class="rounded-md border border-stone-300 bg-white px-2 py-1 text-sm leading-none disabled:cursor-not-allowed disabled:opacity-40"
          hx-get={buildPageUrl(props.page + 1)}
          hx-target="#book-list"
          hx-swap="innerHTML"
          disabled={!hasNext}
        >
          &gt;
        </button>
      </div>
    ) : null

  const pagination =
    props.totalPages > 1 ? (
      <div class="mt-3 flex items-center justify-between gap-2 text-xs text-stone-600">
        <button
          type="button"
          class="rounded-md border border-stone-300 bg-white px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
          hx-get={buildPageUrl(props.page - 1)}
          hx-target="#book-list"
          hx-swap="innerHTML"
          disabled={!hasPrev}
        >
          前へ
        </button>
        <p>
          {props.page} / {props.totalPages} ページ
        </p>
        <button
          type="button"
          class="rounded-md border border-stone-300 bg-white px-3 py-1.5 disabled:cursor-not-allowed disabled:opacity-40"
          hx-get={buildPageUrl(props.page + 1)}
          hx-target="#book-list"
          hx-swap="innerHTML"
          disabled={!hasNext}
        >
          次へ
        </button>
      </div>
    ) : null

  const countLabel = props.query.length > 0 ? `検索結果 ${props.totalCount} 件` : `全 ${props.totalCount} 件`

  if (props.books.length === 0) {
    return (
      <div class="space-y-3">
        <form class="flex flex-col gap-2 sm:flex-row" hx-get="/books" hx-target="#book-list" hx-swap="innerHTML">
          <input type="hidden" name="page" value="1" />
          <input
            type="search"
            name="q"
            value={props.query}
            placeholder="タイトル・著者・出版社・ISBNで検索"
            class="w-full rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
          />
          <button type="submit" class="rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700">
            検索
          </button>
        </form>
        <div class="flex items-center justify-between gap-3">
          <p class="text-xs text-stone-500">{countLabel}</p>
          {compactPagination}
        </div>
        <p class="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
          {props.query.length > 0 ? '条件に一致する本がありません。' : 'まだ登録がありません。'}
        </p>
      </div>
    )
  }

  return (
    <div class="space-y-3">
      <form class="flex flex-col gap-2 sm:flex-row" hx-get="/books" hx-target="#book-list" hx-swap="innerHTML">
        <input type="hidden" name="page" value="1" />
        <input
          type="search"
          name="q"
          value={props.query}
          placeholder="タイトル・著者・出版社・ISBNで検索"
          class="w-full rounded-xl border border-stone-300 bg-white px-4 py-2 text-sm outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
        />
        <button type="submit" class="rounded-xl bg-stone-900 px-4 py-2 text-sm font-semibold text-white hover:bg-stone-700">
          検索
        </button>
      </form>

      <div class="flex items-center justify-between gap-3">
        <p class="text-xs text-stone-500">{countLabel}</p>
        {compactPagination}
      </div>

      <ul class="space-y-2">
        {props.books.map((book, index) => {
          const isNewest = props.highlightNewest === true && index === 0
          const itemClass = isNewest
            ? 'relative rounded-xl border border-emerald-300 bg-white px-4 py-3'
            : 'rounded-xl border border-stone-200 bg-white px-4 py-3'

          const editUrl = `/books/${book.id}/edit?q=${encodeURIComponent(props.query)}&page=${encodeURIComponent(String(props.page))}`
          return (
            <li key={book.id} class={itemClass}>
              {isNewest ? (
                <span class="absolute left-3 top-3 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">NEW</span>
              ) : null}

              <div class="mb-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  class="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 transition hover:bg-stone-100"
                  hx-get={editUrl}
                  hx-target={`#book-edit-${book.id}`}
                  hx-swap="innerHTML"
                >
                  編集
                </button>
                <form hx-post={`/books/${book.id}/delete`} hx-target="#result" hx-swap="innerHTML" hx-confirm="この本を削除します。よろしいですか？">
                  <input type="hidden" name="csrf_token" value={props.csrfToken} />
                  <input type="hidden" name="q" value={props.query} />
                  <input type="hidden" name="page" value={String(props.page)} />
                  <button
                    type="submit"
                    class="rounded-md border border-rose-300 bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 transition hover:bg-rose-100"
                  >
                    削除
                  </button>
                </form>
              </div>

              <div class="flex gap-3">
                <img
                  src={book.cover_url || NO_IMAGE_DATA_URL}
                  alt={`${book.title || '書影'} の書影`}
                  class="h-16 w-12 shrink-0 rounded-md border border-stone-200 bg-stone-50 object-cover"
                  loading="lazy"
                />
                <div class="min-w-0">
                  <p class="text-sm font-semibold text-stone-900">{book.title || 'タイトル未登録'}</p>
                  <p class="mt-1 text-sm text-stone-700">ISBN: {book.isbn || '-'}</p>
                  <p class="mt-1 text-xs text-stone-500">著者: {book.author || '-'} / 出版社: {book.publisher || '-'}</p>
                  <p class="mt-1 text-xs text-stone-500">出版日: {book.published_at || '-'}</p>
                  <p class="mt-1 text-xs text-stone-500">登録日時: {formatCreatedAt(book.created_at)}</p>
                </div>
              </div>
              <div id={`book-edit-${book.id}`} class="mt-2"></div>
            </li>
          )
        })}
      </ul>

      {pagination}
    </div>
  )
}
