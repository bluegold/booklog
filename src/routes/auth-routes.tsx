import type { Hono } from 'hono'
import { buildGoogleAuthUrl, exchangeCodeForAccessToken, fetchGoogleUserInfo } from '../external/google-auth.js'
import { upsertUserByGoogleSub } from '../repositories/users-repository.js'
import {
  buildOAuthStateClearCookie,
  buildOAuthStateCookie,
  buildSessionClearCookie,
  buildSessionCookie,
  createOAuthState,
  createSessionToken,
  getOAuthStateFromRequest,
} from '../security/session.js'
import { ResultMessage } from '../templates/partials/result-message.js'
import type { AppEnv } from '../types.js'

type StartOAuthConfig = {
  clientId: string
  redirectUri: string
}

type CallbackOAuthConfig = {
  clientId: string
  clientSecret: string
  redirectUri: string
  sessionSecret: string
}

// Cookie 属性を決めるため、アクセス元 URL から HTTPS を判定する。
const getIsSecureRequest = (requestUrl: string): boolean => {
  return new URL(requestUrl).protocol === 'https:'
}

// OAuth 開始に必要な最小構成だけを取り出す。
const requireStartOAuthConfig = (env: AppEnv['Bindings']): StartOAuthConfig | null => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_REDIRECT_URI) {
    return null
  }

  return {
    clientId: env.GOOGLE_CLIENT_ID,
    redirectUri: env.GOOGLE_REDIRECT_URI,
  }
}

// コールバック処理に必要な構成が揃っていることを確認する。
const requireCallbackOAuthConfig = (env: AppEnv['Bindings']): CallbackOAuthConfig | null => {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_REDIRECT_URI || !env.SESSION_SECRET) {
    return null
  }

  return {
    clientId: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    redirectUri: env.GOOGLE_REDIRECT_URI,
    sessionSecret: env.SESSION_SECRET,
  }
}

// ローカル確認用に OAuth 開始設定の有無をダンプする。
const logStartConfigIfDebug = (env: AppEnv['Bindings']): void => {
  if (env.DEBUG !== '1') {
    return
  }

  console.log('[oauth] /auth/google/start config', {
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID ? `${env.GOOGLE_CLIENT_ID.slice(0, 8)}...` : undefined,
    GOOGLE_REDIRECT_URI: env.GOOGLE_REDIRECT_URI,
  })
}

// コールバック処理で必要な設定の有無をダンプする。
const logCallbackConfigIfDebug = (env: AppEnv['Bindings']): void => {
  if (env.DEBUG !== '1') {
    return
  }

  console.log('[oauth] /auth/google/callback config', {
    GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID ? `${env.GOOGLE_CLIENT_ID.slice(0, 8)}...` : undefined,
    GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET ? '(set)' : undefined,
    GOOGLE_REDIRECT_URI: env.GOOGLE_REDIRECT_URI,
    SESSION_SECRET: env.SESSION_SECRET ? '(set)' : undefined,
  })
}

// 設定不足時の共通エラー表示。
const renderMissingOAuthConfig = () => {
  return <ResultMessage message="Google OAuth の設定が不足しています。" tone="error" />
}

export const registerAuthRoutes = (app: Hono<AppEnv>): void => {
  // Google の認可画面へリダイレクトする開始エンドポイント。
  app.get('/auth/google/start', (c) => {
    logStartConfigIfDebug(c.env)
    const config = requireStartOAuthConfig(c.env)

    if (!config) {
      return c.html(renderMissingOAuthConfig(), 500)
    }

    const state = createOAuthState()
    const isSecure = getIsSecureRequest(c.req.url)

    c.header('Set-Cookie', buildOAuthStateCookie(state, isSecure), { append: true })
    const authUrl = buildGoogleAuthUrl({ clientId: config.clientId, clientSecret: '', redirectUri: config.redirectUri }, state)
    return c.redirect(authUrl)
  })

  // 認可コードを検証し、ユーザーをセッションへログインさせる。
  app.get('/auth/google/callback', async (c) => {
    logCallbackConfigIfDebug(c.env)
    const config = requireCallbackOAuthConfig(c.env)

    if (!config) {
      return c.html(renderMissingOAuthConfig(), 500)
    }

    const state = c.req.query('state') ?? ''
    const code = c.req.query('code') ?? ''
    const expectedState = getOAuthStateFromRequest(c.req.raw)
    const isSecure = getIsSecureRequest(c.req.url)

    c.header('Set-Cookie', buildOAuthStateClearCookie(isSecure), { append: true })

    if (!state || !code || !expectedState || state !== expectedState) {
      return c.html(<ResultMessage message="Google 認証の state 検証に失敗しました。" tone="error" />, 400)
    }

    const accessToken = await exchangeCodeForAccessToken(
      { clientId: config.clientId, clientSecret: config.clientSecret, redirectUri: config.redirectUri },
      code
    )
    if (!accessToken) {
      return c.html(<ResultMessage message="Google からのトークン取得に失敗しました。" tone="error" />, 400)
    }

    const profile = await fetchGoogleUserInfo(accessToken)
    if (!profile) {
      return c.html(<ResultMessage message="Google ユーザー情報の取得に失敗しました。" tone="error" />, 400)
    }

    const user = await upsertUserByGoogleSub(c.env.DB, {
      googleSub: profile.sub,
      email: profile.email,
      name: profile.name,
      pictureUrl: profile.picture,
    })

    const token = await createSessionToken(config.sessionSecret, {
      id: user.id,
      email: user.email,
      name: user.name ?? profile.name,
      userType: user.user_type,
      pictureUrl: user.picture_url ?? profile.picture,
    })

    c.header('Set-Cookie', buildSessionCookie(token, isSecure), { append: true })
    return c.redirect('/')
  })

  // セッション Cookie を削除してログアウトする。
  app.post('/auth/logout', (c) => {
    const isSecure = getIsSecureRequest(c.req.url)
    c.header('Set-Cookie', buildSessionClearCookie(isSecure), { append: true })
    return c.redirect('/')
  })
}
