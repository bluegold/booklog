const CSRF_COOKIE_NAME = 'csrf_token'
const CSRF_TOKEN_BYTES = 32

const toBase64Url = (bytes: Uint8Array): string => {
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

const parseCookies = (cookieHeader: string | null): Map<string, string> => {
  const cookies = new Map<string, string>()

  if (!cookieHeader) {
    return cookies
  }

  for (const chunk of cookieHeader.split(';')) {
    const [namePart, ...valueParts] = chunk.trim().split('=')
    if (!namePart || valueParts.length === 0) {
      continue
    }

    cookies.set(namePart, decodeURIComponent(valueParts.join('=')))
  }

  return cookies
}

const constantTimeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false
  }

  let mismatch = 0
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return mismatch === 0
}

export const createCsrfToken = (): string => {
  const bytes = new Uint8Array(CSRF_TOKEN_BYTES)
  crypto.getRandomValues(bytes)
  return toBase64Url(bytes)
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
