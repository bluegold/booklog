import { Layout } from '../layout.js'
import { BookForm } from '../partials/book-form.js'

type HomePageProps = {
  csrfToken: string
}

export const HomePage = (props: HomePageProps) => {
  return (
    <Layout>
      <div class="space-y-6">
        <BookForm csrfToken={props.csrfToken} />
        <div id="result" class="min-h-12"></div>
        <section class="space-y-3">
          <h2 class="text-lg font-semibold text-stone-900">登録済みの本</h2>
          <div id="book-list" hx-get="/books" hx-trigger="load" hx-swap="innerHTML">
            <p class="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">読み込み中...</p>
          </div>
        </section>
      </div>
    </Layout>
  )
}
