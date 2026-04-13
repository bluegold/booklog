type BookFormProps = {
  csrfToken: string
}

export const BookForm = (props: BookFormProps) => {
  return (
    <form hx-post="/books" hx-target="#result" hx-swap="innerHTML" class="space-y-3">
      <input type="hidden" name="csrf_token" value={props.csrfToken} />
      <label class="block text-sm font-medium text-stone-700" htmlFor="isbn-input">
        ISBN
      </label>
      <div class="flex flex-col gap-2 sm:flex-row">
        <input
          id="isbn-input"
          name="isbn"
          placeholder="例: 9784003101018"
          class="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-base outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
        />
        <button
          type="submit"
          class="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-200"
        >
          登録
        </button>
      </div>
    </form>
  )
}
