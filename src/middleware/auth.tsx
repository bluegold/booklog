import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../types.js'
import { findUserById } from '../repositories/users-repository.js'
import { buildSessionClearCookie, parseSessionFromRequest } from '../security/session.js'
import { ResultMessage } from '../templates/partials/result-message.js'

const getIsSecureRequest = (requestUrl: string): boolean => {
  return new URL(requestUrl).protocol === 'https:'
}

export const sessionAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const secret = c.env?.SESSION_SECRET ?? ''
  let authUser = secret ? await parseSessionFromRequest(c.req.raw, secret) : null

  if (authUser && c.env.DB) {
    const adminActorId = authUser.impersonator?.id ?? (authUser.userType === 'admin' ? authUser.id : null)

    if (adminActorId !== null) {
      const adminActor = await findUserById(c.env.DB, adminActorId)
      if (!adminActor || adminActor.user_type !== 'admin') {
        if (authUser.impersonator) {
          authUser = null
          c.header('Set-Cookie', buildSessionClearCookie(getIsSecureRequest(c.req.url)), { append: true })
        } else {
          authUser = {
            ...authUser,
            userType: 'user',
          }
        }
      }
    }
  }

  c.set('authUser', authUser)
  await next()
}

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const authUser = c.get('authUser')

  if (!authUser) {
    return c.html(<ResultMessage message="ログインが必要です。" tone="error" />, 401)
  }

  await next()
}

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const authUser = c.get('authUser')

  if (!authUser || (authUser.userType !== 'admin' && !authUser.impersonator)) {
    return c.html(<ResultMessage message="管理者権限が必要です。" tone="error" />, 403)
  }

  await next()
}
