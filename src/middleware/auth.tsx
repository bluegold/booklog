import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../types.js'
import { parseSessionFromRequest } from '../security/session.js'
import { ResultMessage } from '../templates/partials/result-message.js'

export const sessionAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  const secret = c.env?.SESSION_SECRET ?? ''
  const authUser = secret ? await parseSessionFromRequest(c.req.raw, secret) : null
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
