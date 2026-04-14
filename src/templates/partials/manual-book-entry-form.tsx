import { BookMetadataFields } from './book-metadata-fields.js'

type ManualBookEntryFormProps = {
  csrfToken: string
  isbn: string
}

export const ManualBookEntryForm = (props: ManualBookEntryFormProps) => {
  return (
    <div class="inline-form-enter rounded-xl border border-amber-300 bg-amber-50 p-4">
      <p class="mb-2 text-sm font-semibold text-amber-900">ISBN {props.isbn} を手入力で登録</p>
      <form hx-post="/books/manual" hx-target="#result" hx-swap="innerHTML" class="space-y-3">
        <input type="hidden" name="csrf_token" value={props.csrfToken} />
        <label class="text-xs text-stone-600">
          ISBN
          <input
            type="text"
            name="isbn"
            value={props.isbn}
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
