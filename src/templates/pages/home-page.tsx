import { Layout } from '../layout.js'
import { BookForm } from '../partials/book-form.js'
import type { AuthUser } from '../../types.js'

type HomePageProps = {
  csrfToken: string
  authUser: AuthUser | null
}

export const HomePage = (props: HomePageProps) => {
  const isAdminSession = !!props.authUser && (props.authUser.userType === 'admin' || !!props.authUser.impersonator)

  return (
    <Layout>
      <div class="space-y-6">
        <div class="flex items-center justify-between rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm">
          {props.authUser ? (
            <div class="flex items-center gap-3">
              {props.authUser.pictureUrl ? (
                <img
                  src={props.authUser.pictureUrl}
                  alt={`${props.authUser.name || props.authUser.email} のアイコン`}
                  class="h-9 w-9 rounded-full border border-stone-200 bg-white object-cover"
                  referrerpolicy="no-referrer"
                />
              ) : null}
              <p class="text-stone-700">
                ログイン中: <span class="font-medium text-stone-900">{props.authUser.name || props.authUser.email}</span>
              </p>
              {props.authUser.impersonator ? (
                <p class="text-xs text-amber-700">管理者 {props.authUser.impersonator.name} として impersonate 中</p>
              ) : null}
            </div>
          ) : (
            <p class="text-stone-700">未ログイン</p>
          )}

          {props.authUser ? (
            <div class="flex items-center gap-2">
              {isAdminSession ? (
                <details class="relative">
                  <summary class="list-none cursor-pointer rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100">
                    管理
                  </summary>
                  <div class="absolute right-0 z-20 mt-2 w-52 rounded-lg border border-stone-200 bg-white p-2 shadow-lg">
                    <a href="/admin/users" class="block rounded-md px-3 py-2 text-xs text-stone-700 hover:bg-stone-100">
                      ユーザ管理
                    </a>
                    {props.authUser.impersonator ? (
                      <form method="post" action="/admin/impersonate/stop">
                        <input type="hidden" name="csrf_token" value={props.csrfToken} />
                        <button type="submit" class="mt-1 w-full rounded-md px-3 py-2 text-left text-xs text-amber-800 hover:bg-amber-50">
                          impersonate を解除
                        </button>
                      </form>
                    ) : null}
                  </div>
                </details>
              ) : null}
              <form method="post" action="/auth/logout">
                <input type="hidden" name="csrf_token" value={props.csrfToken} />
                <button type="submit" class="rounded-lg border border-stone-300 bg-white px-3 py-1.5 text-xs font-medium text-stone-700 hover:bg-stone-100">
                  ログアウト
                </button>
              </form>
            </div>
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
