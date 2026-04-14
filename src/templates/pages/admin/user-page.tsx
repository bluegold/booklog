import { Layout } from '../../layout.js'
import type { AuthUser } from '../../../types.js'
import type { UserSummaryRow } from '../../../repositories/users-repository.js'

type UserPageProps = {
  csrfToken: string
  authUser: AuthUser
  users: UserSummaryRow[]
}

export const UserPage = (props: UserPageProps) => {
  return (
    <Layout>
      <section class="space-y-4">
        <div class="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3">
          <h2 class="text-lg font-semibold text-stone-900">ユーザ管理</h2>
          <p class="mt-1 text-sm text-stone-600">ユーザ一覧、登録書籍数、impersonate を操作できます。</p>
        </div>

        {props.authUser.impersonator ? (
          <div class="flex items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p>
              管理者 {props.authUser.impersonator.name} として {props.authUser.name} を impersonate 中です。
            </p>
            <form method="post" action="/admin/impersonate/stop">
              <input type="hidden" name="csrf_token" value={props.csrfToken} />
              <button type="submit" class="rounded-md border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium hover:bg-amber-100">
                impersonate を解除
              </button>
            </form>
          </div>
        ) : null}

        <div class="overflow-x-auto rounded-lg border border-stone-200 bg-white">
          <table class="min-w-full divide-y divide-stone-200 text-sm">
            <thead class="bg-stone-100 text-left text-xs uppercase tracking-wide text-stone-600">
              <tr>
                <th class="px-3 py-2">ユーザ</th>
                <th class="px-3 py-2">種別</th>
                <th class="px-3 py-2 text-right">登録書籍数</th>
                <th class="px-3 py-2 text-right">操作</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-stone-100">
              {props.users.map((user) => {
                const isCurrent = user.id === props.authUser.id
                const isActingAdmin = props.authUser.impersonator?.id === user.id
                const disableImpersonate = user.id === (props.authUser.impersonator?.id ?? props.authUser.id)

                return (
                  <tr key={user.id}>
                    <td class="px-3 py-2 text-stone-800">
                      <div class="font-medium">{user.name || user.email}</div>
                      <div class="text-xs text-stone-500">{user.email}</div>
                      {isCurrent ? <div class="mt-1 text-xs text-emerald-700">現在の閲覧ユーザ</div> : null}
                      {isActingAdmin ? <div class="mt-1 text-xs text-amber-700">管理者本人</div> : null}
                    </td>
                    <td class="px-3 py-2">
                      <span class="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-700">{user.user_type}</span>
                    </td>
                    <td class="px-3 py-2 text-right font-medium text-stone-800">{user.book_count}</td>
                    <td class="px-3 py-2 text-right">
                      <form method="post" action="/admin/impersonate">
                        <input type="hidden" name="csrf_token" value={props.csrfToken} />
                        <input type="hidden" name="target_user_id" value={String(user.id)} />
                        <button
                          type="submit"
                          class="rounded-md border border-stone-300 bg-white px-2.5 py-1 text-xs font-medium text-stone-700 hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-50"
                          disabled={disableImpersonate}
                        >
                          impersonate
                        </button>
                      </form>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </Layout>
  )
}
