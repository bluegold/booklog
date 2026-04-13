import { Layout } from '../layout.js'
import { BookForm } from '../partials/book-form.js'
import type { AuthUser } from '../../types.js'

type HomePageProps = {
  csrfToken: string
  authUser: AuthUser | null
}

export const HomePage = (props: HomePageProps) => {
  return (
    <Layout>
      <div class="space-y-6">
        <div class="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm">
          {props.authUser ? (
            <p class="text-stone-700">
              ログイン中: <span class="font-medium text-stone-900">{props.authUser.name || props.authUser.email}</span>
            </p>
          ) : (
            <p class="text-stone-700">未ログイン</p>
          )}

          {props.authUser ? (
            <form method="post" action="/auth/logout">
              <button type="submit" class="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100">
                ログアウト
              </button>
            </form>
          ) : (
            <a href="/auth/google/start" class="rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-700">
              Googleでログイン
            </a>
          )}
        </div>
        {props.authUser ? (
          <>
            <BookForm csrfToken={props.csrfToken} />
            <div id="result" class="min-h-12"></div>
            <section class="space-y-3">
              <h2 class="text-lg font-semibold text-stone-900">登録済みの本</h2>
              <div id="book-list" hx-get="/books" hx-trigger="load" hx-swap="innerHTML">
                <p class="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">読み込み中...</p>
              </div>
            </section>
          </>
        ) : (
          <p class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            登録・一覧表示には Google ログインが必要です。
          </p>
        )}
      </div>
    </Layout>
  )
}
