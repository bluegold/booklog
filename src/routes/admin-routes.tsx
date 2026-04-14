import type { Hono } from 'hono'
import { requireAdmin, requireAuth } from '../middleware/auth.js'
import { csrfIssuance, csrfValidation } from '../middleware/csrf.js'
import { findUserById, listUsersWithBookCounts } from '../repositories/users-repository.js'
import { buildSessionCookie, createSessionToken } from '../security/session.js'
import { ResultMessage } from '../templates/partials/result-message.js'
import { UserPage } from '../templates/pages/admin/user-page.js'
import type { AppEnv, AuthUser } from '../types.js'

const getIsSecureRequest = (requestUrl: string): boolean => {
  return new URL(requestUrl).protocol === 'https:'
}

const resolveAdminActor = (authUser: AuthUser): AuthUser['impersonator'] => {
  if (authUser.impersonator) {
    return authUser.impersonator
  }

  if (authUser.userType !== 'admin') {
    return undefined
  }

  return {
    id: authUser.id,
    email: authUser.email,
    name: authUser.name,
  }
}

export const registerAdminRoutes = (app: Hono<AppEnv>): void => {
  app.get('/admin/users', requireAuth, requireAdmin, csrfIssuance, async (c) => {
    const csrfToken = c.get('csrfToken')
    const users = await listUsersWithBookCounts(c.env.DB)
    return c.html(<UserPage csrfToken={csrfToken} users={users} authUser={c.get('authUser')!} />)
  })

  app.post('/admin/impersonate', requireAuth, requireAdmin, csrfValidation, async (c) => {
    const sessionSecret = c.env.SESSION_SECRET ?? ''
    if (!sessionSecret) {
      return c.html(<ResultMessage message="SESSION_SECRET が未設定です。" tone="error" />, 500)
    }

    const authUser = c.get('authUser')!
    const adminActor = resolveAdminActor(authUser)

    if (!adminActor) {
      return c.html(<ResultMessage message="管理者情報の解決に失敗しました。" tone="error" />, 403)
    }

    const adminUser = await findUserById(c.env.DB, adminActor.id)
    if (!adminUser || adminUser.user_type !== 'admin') {
      return c.html(<ResultMessage message="管理者権限が確認できませんでした。" tone="error" />, 403)
    }

    const form = c.get('parsedForm')
    const targetUserId = Number(form.get('target_user_id')?.toString() ?? '')

    if (!Number.isFinite(targetUserId)) {
      return c.html(<ResultMessage message="対象ユーザが不正です。" tone="error" />, 400)
    }

    const targetUser = await findUserById(c.env.DB, targetUserId)
    if (!targetUser) {
      return c.html(<ResultMessage message="対象ユーザが見つかりません。" tone="error" />, 404)
    }

    const token = await createSessionToken(sessionSecret, {
      id: targetUser.id,
      email: targetUser.email,
      name: targetUser.name ?? targetUser.email,
      userType: targetUser.user_type,
      pictureUrl: targetUser.picture_url ?? undefined,
      impersonator: adminActor,
    })

    c.header('Set-Cookie', buildSessionCookie(token, getIsSecureRequest(c.req.url)))
    return c.redirect('/')
  })

  app.post('/admin/impersonate/stop', requireAuth, requireAdmin, csrfValidation, async (c) => {
    const sessionSecret = c.env.SESSION_SECRET ?? ''
    if (!sessionSecret) {
      return c.html(<ResultMessage message="SESSION_SECRET が未設定です。" tone="error" />, 500)
    }

    const authUser = c.get('authUser')!
    const adminActor = resolveAdminActor(authUser)

    if (!adminActor) {
      return c.html(<ResultMessage message="管理者情報の解決に失敗しました。" tone="error" />, 403)
    }

    const adminUser = await findUserById(c.env.DB, adminActor.id)
    if (!adminUser || adminUser.user_type !== 'admin') {
      return c.html(<ResultMessage message="管理者権限が確認できませんでした。" tone="error" />, 403)
    }

    const token = await createSessionToken(sessionSecret, {
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name ?? adminUser.email,
      userType: adminUser.user_type,
      pictureUrl: adminUser.picture_url ?? undefined,
    })

    c.header('Set-Cookie', buildSessionCookie(token, getIsSecureRequest(c.req.url)))
    return c.redirect('/')
  })
}
