import { Layout } from '../layout.js'

export const HomeLoggedOutPage = () => {
  return (
    <Layout>
      <div class="space-y-6">
        <div class="flex flex-col gap-3 border-x-0 border-y border-stone-200 bg-stone-50 px-4 py-3 text-sm -mx-5 sm:mx-0 sm:flex-row sm:items-center sm:justify-between sm:rounded-xl sm:border">
          <p class="text-stone-700">未ログイン</p>

          <a href="/auth/google/start" class="self-end rounded-lg bg-stone-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-stone-700">
            Googleでログイン
          </a>
        </div>

        <p class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          登録・一覧表示には Google ログインが必要です。
        </p>
      </div>
    </Layout>
  )
}
