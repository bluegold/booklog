type BookMetadataFieldsProps = {
  title?: string | null
  author?: string | null
  publisher?: string | null
  publishedAt?: string | null
  coverUrl?: string | null
}

export const BookMetadataFields = (props: BookMetadataFieldsProps) => {
  return (
    <div class="grid gap-2 sm:grid-cols-2">
      <label class="text-xs text-stone-600">
        タイトル
        <input
          type="text"
          name="title"
          value={props.title ?? ''}
          class="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
      </label>
      <label class="text-xs text-stone-600">
        著者
        <input
          type="text"
          name="author"
          value={props.author ?? ''}
          class="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
      </label>
      <label class="text-xs text-stone-600">
        出版社
        <input
          type="text"
          name="publisher"
          value={props.publisher ?? ''}
          class="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
      </label>
      <label class="text-xs text-stone-600">
        出版日
        <input
          type="text"
          name="published_at"
          value={props.publishedAt ?? ''}
          placeholder="例: 2024-04-01"
          class="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
      </label>
      <label class="text-xs text-stone-600 sm:col-span-2">
        書影 URL
        <input
          type="url"
          name="cover_url"
          value={props.coverUrl ?? ''}
          placeholder="https://..."
          class="mt-1 w-full rounded-lg border border-stone-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-600 focus:ring-2 focus:ring-emerald-100"
        />
      </label>
    </div>
  )
}
