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
  if (props.books.length === 0) {
    return <p class="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">まだ登録がありません。</p>
  }

  return (
    <ul class="space-y-2">
      {props.books.map((book, index) => {
        const isNewest = props.highlightNewest === true && index === 0
        const itemClass = isNewest
          ? 'relative rounded-xl border border-emerald-300 bg-white px-4 py-3'
          : 'rounded-xl border border-stone-200 bg-white px-4 py-3'
        return (
          <li key={book.id} class={itemClass}>
            {isNewest ? (
              <span class="absolute right-3 top-3 rounded-md bg-emerald-600 px-2 py-0.5 text-[10px] font-bold tracking-wide text-white">NEW</span>
            ) : null}
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
          </li>
        )
      })}
    </ul>
  )
}
