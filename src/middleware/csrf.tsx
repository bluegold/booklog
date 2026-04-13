import type { MiddlewareHandler } from 'hono'
import type { AppEnv } from '../types.js'
import { buildCsrfSetCookie, createCsrfToken, isValidCsrfToken } from '../security/csrf.js'
import { ResultMessage } from '../templates/partials/result-message.js'

export const csrfIssuance: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = createCsrfToken()
  const isSecure = new URL(c.req.url).protocol === 'https:'
  c.header('Set-Cookie', buildCsrfSetCookie(token, isSecure))
  c.set('csrfToken', token)
  await next()
}

export const csrfValidation: MiddlewareHandler<AppEnv> = async (c, next) => {
  const form = await c.req.formData()
  const submittedToken = form.get('csrf_token')?.toString() ?? ''

  if (!isValidCsrfToken(c.req.raw, submittedToken)) {
    c.status(403)
    return c.html(
      <ResultMessage message="不正なリクエストです。ページを再読み込みしてやり直してください。" tone="error" />
    )
  }

  c.set('parsedForm', form)
  await next()
}
