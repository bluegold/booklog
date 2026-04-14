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

const resolveVerifiedAdmin = async (
  db: D1Database,
  authUser: AuthUser
): Promise<{
  adminActor: NonNullable<AuthUser['impersonator']>
  adminUser: NonNullable<Awaited<ReturnType<typeof findUserById>>>
} | null> => {
  const adminActor = resolveAdminActor(authUser)
  if (!adminActor) {
    return null
  }

  const adminUser = await findUserById(db, adminActor.id)
  if (!adminUser || adminUser.user_type !== 'admin') {
    return null
  }

  return {
    adminActor,
    adminUser,
  }
}

export const registerAdminRoutes = (app: Hono<AppEnv>): void => {
  app.get('/admin/users', requireAuth, requireAdmin, csrfIssuance, async (c) => {
    const verifiedAdmin = await resolveVerifiedAdmin(c.env.DB, c.get('authUser')!)
    if (!verifiedAdmin) {
      return c.html(<ResultMessage message="管理者権限が確認できませんでした。" tone="error" />, 403)
    }

    const csrfToken = c.get('csrfToken')
    const users = await listUsersWithBookCounts(c.env.DB)
    return c.html(<UserPage csrfToken={csrfToken} users={users} authUser={c.get('authUser')!} />)
  })

  app.post('/admin/impersonate', requireAuth, requireAdmin, csrfValidation, async (c) => {
    const sessionSecret = c.env.SESSION_SECRET ?? ''
    if (!sessionSecret) {
      return c.html(<ResultMessage message="SESSION_SECRET が未設定です。" tone="error" />, 500)
    }

    const verifiedAdmin = await resolveVerifiedAdmin(c.env.DB, c.get('authUser')!)
    if (!verifiedAdmin) {
      return c.html(<ResultMessage message="管理者権限が確認できませんでした。" tone="error" />, 403)
    }
    const { adminActor } = verifiedAdmin

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

    c.header('Set-Cookie', buildSessionCookie(token, getIsSecureRequest(c.req.url)), { append: true })
    return c.redirect('/')
  })

  app.post('/admin/impersonate/stop', requireAuth, requireAdmin, csrfValidation, async (c) => {
    const sessionSecret = c.env.SESSION_SECRET ?? ''
    if (!sessionSecret) {
      return c.html(<ResultMessage message="SESSION_SECRET が未設定です。" tone="error" />, 500)
    }

    const verifiedAdmin = await resolveVerifiedAdmin(c.env.DB, c.get('authUser')!)
    if (!verifiedAdmin) {
      return c.html(<ResultMessage message="管理者権限が確認できませんでした。" tone="error" />, 403)
    }
    const { adminUser } = verifiedAdmin

    const token = await createSessionToken(sessionSecret, {
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name ?? adminUser.email,
      userType: adminUser.user_type,
      pictureUrl: adminUser.picture_url ?? undefined,
    })

    c.header('Set-Cookie', buildSessionCookie(token, getIsSecureRequest(c.req.url)), { append: true })
    return c.redirect('/')
  })
}
