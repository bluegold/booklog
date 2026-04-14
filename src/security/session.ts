import type { AuthUser } from '../types.js'
import {
  buildCookie,
  decodeBase64Url,
  encodeBase64Url,
  parseCookies,
  createRandomBase64UrlToken,
} from './token-utils.js'

const SESSION_COOKIE_NAME = 'session_token'
const OAUTH_STATE_COOKIE_NAME = 'oauth_state'
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7
const OAUTH_STATE_TTL_SECONDS = 60 * 10

type SessionPayload = {
  id: number
  email: string
  name: string
  userType: 'user' | 'admin'
  impersonator?: {
    id: number
    email: string
    name: string
  }
  pictureUrl?: string | undefined
  exp: number
}

const importHmacKey = async (secret: string): Promise<CryptoKey> => {
  return crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign', 'verify']
  )
}

const sign = async (secret: string, data: string): Promise<string> => {
  const key = await importHmacKey(secret)
  const signatureBuffer = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data))
  const binary = String.fromCharCode(...new Uint8Array(signatureBuffer))
  return encodeBase64Url(binary)
}

const verify = async (secret: string, data: string, signature: string): Promise<boolean> => {
  const expected = await sign(secret, data)
  if (expected.length !== signature.length) {
    return false
  }

  let mismatch = 0
  for (let i = 0; i < expected.length; i += 1) {
    mismatch |= expected.charCodeAt(i) ^ signature.charCodeAt(i)
  }

  return mismatch === 0
}

export const createOAuthState = (): string => {
  return createRandomBase64UrlToken(32)
}

export const buildOAuthStateCookie = (state: string, isSecure: boolean): string => {
  return buildCookie(OAUTH_STATE_COOKIE_NAME, state, OAUTH_STATE_TTL_SECONDS, isSecure)
}

export const buildOAuthStateClearCookie = (isSecure: boolean): string => {
  return buildCookie(OAUTH_STATE_COOKIE_NAME, '', 0, isSecure)
}

export const getOAuthStateFromRequest = (request: Request): string | null => {
  return parseCookies(request.headers.get('cookie')).get(OAUTH_STATE_COOKIE_NAME) ?? null
}

export const createSessionToken = async (secret: string, user: AuthUser): Promise<string> => {
  const payloadBase = {
    id: user.id,
    email: user.email,
    name: user.name,
    userType: user.userType,
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS,
  }
  const payload: SessionPayload = {
    ...payloadBase,
    ...(user.pictureUrl ? { pictureUrl: user.pictureUrl } : {}),
    ...(user.impersonator ? { impersonator: user.impersonator } : {}),
  }

  const payloadJson = JSON.stringify(payload)
  const payloadEncoded = encodeBase64Url(payloadJson)
  const signature = await sign(secret, payloadEncoded)
  return `${payloadEncoded}.${signature}`
}

export const parseSessionFromRequest = async (request: Request, secret: string): Promise<AuthUser | null> => {
  if (!secret) {
    return null
  }

  const token = parseCookies(request.headers.get('cookie')).get(SESSION_COOKIE_NAME)
  if (!token) {
    return null
  }

  const [payloadEncoded, signature] = token.split('.')
  if (!payloadEncoded || !signature) {
    return null
  }

  const valid = await verify(secret, payloadEncoded, signature)
  if (!valid) {
    return null
  }

  const payload = JSON.parse(decodeBase64Url(payloadEncoded)) as SessionPayload
  if (payload.exp < Math.floor(Date.now() / 1000)) {
    return null
  }

  return {
    id: payload.id,
    email: payload.email,
    name: payload.name,
    userType: payload.userType === 'admin' ? 'admin' : 'user',
    ...(payload.impersonator ? { impersonator: payload.impersonator } : {}),
    ...(payload.pictureUrl ? { pictureUrl: payload.pictureUrl } : {}),
  }
}

export const buildSessionCookie = (token: string, isSecure: boolean): string => {
  return buildCookie(SESSION_COOKIE_NAME, token, SESSION_TTL_SECONDS, isSecure)
}

export const buildSessionClearCookie = (isSecure: boolean): string => {
  return buildCookie(SESSION_COOKIE_NAME, '', 0, isSecure)
}
