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
        {/* ZXing が利用できない環境では barcode-scan.js が hidden を解除しない */}
        <button
          id="barcode-scan-btn"
          type="button"
          hidden
          aria-label="バーコードを撮影してISBNを入力"
          class="flex shrink-0 items-center justify-center gap-1.5 rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 transition hover:bg-stone-100 focus:outline-none focus:ring-4 focus:ring-stone-200"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            stroke-width="1.5"
            stroke="currentColor"
            class="h-4 w-4"
            aria-hidden="true"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3 9a2 2 0 0 1 2-2h.172a2 2 0 0 0 1.414-.586l.828-.828A2 2 0 0 1 8.828 5h6.344a2 2 0 0 1 1.414.586l.828.828A2 2 0 0 0 18.828 7H19a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9Z"
            />
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
          </svg>
          スキャン
        </button>
        <button
          type="submit"
          class="rounded-xl bg-emerald-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-800 focus:outline-none focus:ring-4 focus:ring-emerald-200"
        >
          登録
        </button>
      </div>
      {/* ファイル選択は barcode-scan.js が制御する（UIには表示しない） */}
      <input
        id="barcode-file-input"
        type="file"
        accept="image/*"
        capture="environment"
        class="hidden"
        aria-hidden="true"
        tabIndex={-1}
      />
      <p id="barcode-scan-error" hidden role="alert" class="text-xs text-red-600" />
    </form>
  )
}
