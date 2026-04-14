import { BookMetadataFields } from './book-metadata-fields.js'
import type { BookRow } from '../../repositories/books-repository.js'

type BookInlineEditFormProps = {
  csrfToken: string
  book: BookRow
  context: {
    query: string
    page: number
  }
  coverUrlReadonly: boolean
}

export const BookInlineEditForm = (props: BookInlineEditFormProps) => {
  return (
    <div class="inline-form-enter space-y-3 rounded-lg border border-stone-200 bg-stone-50 p-3">
      <div class="mb-2 text-xs text-stone-600">ISBN: {props.book.isbn ?? '-'}</div>
      <form
        hx-post={`/books/${props.book.id}/cover`}
        hx-target="#result"
        hx-swap="innerHTML"
        hx-encoding="multipart/form-data"
        class="mb-3 rounded-md border border-stone-200 bg-white p-2"
      >
        <input type="hidden" name="csrf_token" value={props.csrfToken} />
        <input type="hidden" name="q" value={props.context.query} />
        <input type="hidden" name="page" value={String(props.context.page)} />
        <label class="block text-xs text-stone-600">
          書影画像（JPEG / PNG / WebP, 2MB以下）
          <input
            type="file"
            name="cover_image"
            accept="image/jpeg,image/png,image/webp"
            class="mt-1 block w-full rounded-md border border-stone-300 bg-white px-2 py-1 text-xs text-stone-700"
            onchange={`(function(input){var prev=document.getElementById('cover-preview-${props.book.id}');if(input.files&&input.files[0]){var reader=new FileReader();reader.onload=function(e){prev.src=e.target.result;prev.classList.remove('hidden')};reader.readAsDataURL(input.files[0])}else{prev.src='';prev.classList.add('hidden')}})(this)`}
          />
        </label>
        <img
          id={`cover-preview-${props.book.id}`}
          src=""
          alt="書影プレビュー"
          class="hidden mt-2 h-24 w-auto rounded-md border border-stone-200 object-cover"
        />
        <div class="mt-2 flex justify-end">
          <button
            type="submit"
            class="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-100"
          >
            書影をアップロード
          </button>
        </div>
      </form>

      <form hx-post={`/books/${props.book.id}/edit`} hx-target="#result" hx-swap="innerHTML">
        <input type="hidden" name="csrf_token" value={props.csrfToken} />
        <input type="hidden" name="q" value={props.context.query} />
        <input type="hidden" name="page" value={String(props.context.page)} />
        <BookMetadataFields
          title={props.book.title}
          author={props.book.author}
          publisher={props.book.publisher}
          publishedAt={props.book.published_at}
          coverUrl={props.book.cover_url}
          coverUrlReadonly={props.coverUrlReadonly}
        />
        <div class="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            class="rounded-md border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 transition hover:bg-stone-100"
            onclick={`document.getElementById('book-edit-${props.book.id}').innerHTML=''`}
          >
            キャンセル
          </button>
          <button type="submit" class="rounded-md bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-800">
            保存
          </button>
        </div>
      </form>
    </div>
  )
}
