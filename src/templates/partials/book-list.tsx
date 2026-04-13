type BookRow = {
  id: number
  isbn: string | null
  title: string | null
  author: string | null
  publisher: string | null
  created_at: string | null
}

type BookListContentProps = {
  books: BookRow[]
}

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
      {props.books.map((book) => {
        return (
          <li key={book.id} class="rounded-xl border border-stone-200 bg-white px-4 py-3">
            <p class="text-sm font-semibold text-stone-900">{book.title || 'タイトル未登録'}</p>
            <p class="mt-1 text-sm text-stone-700">ISBN: {book.isbn || '-'}</p>
            <p class="mt-1 text-xs text-stone-500">著者: {book.author || '-'} / 出版社: {book.publisher || '-'}</p>
            <p class="mt-1 text-xs text-stone-500">登録日時: {formatCreatedAt(book.created_at)}</p>
          </li>
        )
      })}
    </ul>
  )
}
