import { buildCookie, constantTimeEqual, createRandomBase64UrlToken, parseCookies } from './token-utils.js'

const CSRF_COOKIE_NAME = 'csrf_token'
const CSRF_TOKEN_BYTES = 32

export const createCsrfToken = (): string => {
  return createRandomBase64UrlToken(CSRF_TOKEN_BYTES)
}

export const buildCsrfSetCookie = (token: string, isSecure: boolean): string => {
  const secure = isSecure ? '; Secure' : ''
  return `${CSRF_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=7200${secure}`
}

export const getCsrfTokenFromRequest = (request: Request): string | null => {
  return parseCookies(request.headers.get('cookie')).get(CSRF_COOKIE_NAME) ?? null
}

export const isValidCsrfToken = (request: Request, submittedToken: string): boolean => {
  const cookieToken = parseCookies(request.headers.get('cookie')).get(CSRF_COOKIE_NAME)
  if (!cookieToken || !submittedToken) {
    return false
  }

  return constantTimeEqual(cookieToken, submittedToken)
}
