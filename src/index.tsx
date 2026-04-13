import { Hono } from 'hono'
import type { AppEnv } from './types.js'
import { addBookByIsbn, listBooks } from './services/books-service.js'
import { buildGoogleAuthUrl, exchangeCodeForAccessToken, fetchGoogleUserInfo } from './external/google-auth.js'
import { requireAuth, sessionAuth } from './middleware/auth.js'
import { csrfIssuance, csrfValidation } from './middleware/csrf.js'
import { upsertUserByGoogleSub } from './repositories/users-repository.js'
import {
  buildOAuthStateClearCookie,
  buildOAuthStateCookie,
  buildSessionClearCookie,
  buildSessionCookie,
  createOAuthState,
  createSessionToken,
  getOAuthStateFromRequest,
} from './security/session.js'
import { HomePage } from './templates/pages/home-page.js'
import { BookListContent } from './templates/partials/book-list.js'
import { ResultMessage } from './templates/partials/result-message.js'

const app = new Hono<AppEnv>()

app.use('*', sessionAuth)

app.get('/', csrfIssuance, (c) => {
  return c.html(<HomePage csrfToken={c.get('csrfToken')} authUser={c.get('authUser')} />)
})

app.get('/auth/google/start', (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID
  const redirectUri = c.env.GOOGLE_REDIRECT_URI

  if (c.env.DEBUG === '1') {
    console.log('[oauth] /auth/google/start config', {
      GOOGLE_CLIENT_ID: clientId ? `${clientId.slice(0, 8)}...` : undefined,
      GOOGLE_REDIRECT_URI: redirectUri,
    })
  }

  if (!clientId || !redirectUri) {
    return c.html(<ResultMessage message="Google OAuth の設定が不足しています。" tone="error" />, 500)
  }

  const state = createOAuthState()
  const isSecure = new URL(c.req.url).protocol === 'https:'

  c.header('Set-Cookie', buildOAuthStateCookie(state, isSecure))
  const authUrl = buildGoogleAuthUrl({ clientId, clientSecret: '', redirectUri }, state)
  return c.redirect(authUrl)
})

app.get('/auth/google/callback', async (c) => {
  const clientId = c.env.GOOGLE_CLIENT_ID
  const clientSecret = c.env.GOOGLE_CLIENT_SECRET
  const redirectUri = c.env.GOOGLE_REDIRECT_URI
  const sessionSecret = c.env.SESSION_SECRET

  if (c.env.DEBUG === '1') {
    console.log('[oauth] /auth/google/callback config', {
      GOOGLE_CLIENT_ID: clientId ? `${clientId.slice(0, 8)}...` : undefined,
      GOOGLE_CLIENT_SECRET: clientSecret ? '(set)' : undefined,
      GOOGLE_REDIRECT_URI: redirectUri,
      SESSION_SECRET: sessionSecret ? '(set)' : undefined,
    })
  }

  if (!clientId || !clientSecret || !redirectUri || !sessionSecret) {
    return c.html(<ResultMessage message="Google OAuth の設定が不足しています。" tone="error" />, 500)
  }

  const state = c.req.query('state') ?? ''
  const code = c.req.query('code') ?? ''
  const expectedState = getOAuthStateFromRequest(c.req.raw)
  const isSecure = new URL(c.req.url).protocol === 'https:'

  c.header('Set-Cookie', buildOAuthStateClearCookie(isSecure))

  if (!state || !code || !expectedState || state !== expectedState) {
    return c.html(<ResultMessage message="Google 認証の state 検証に失敗しました。" tone="error" />, 400)
  }

  const accessToken = await exchangeCodeForAccessToken({ clientId, clientSecret, redirectUri }, code)
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

  const token = await createSessionToken(sessionSecret, {
    id: user.id,
    email: user.email,
    name: user.name ?? profile.name,
  })

  c.header('Set-Cookie', buildSessionCookie(token, isSecure))
  return c.redirect('/')
})

app.post('/auth/logout', (c) => {
  const isSecure = new URL(c.req.url).protocol === 'https:'
  c.header('Set-Cookie', buildSessionClearCookie(isSecure))
  return c.redirect('/')
})

app.get('/books', requireAuth, async (c) => {
  const books = await listBooks(c.env.DB, c.get('authUser')!.id)
  return c.html(<BookListContent books={books} />)
})

app.post('/books', requireAuth, csrfValidation, async (c) => {
  const result = await addBookByIsbn(c.env.DB, c.get('authUser')!.id, c.get('parsedForm').get('isbn')?.toString(), {
    debug: c.env.DEBUG === '1',
  })

  if (result.status === 'validation-error' || result.status === 'duplicate') {
    return c.html(
      <>
        <ResultMessage message={result.message} tone="error" />
        <div id="book-list" hx-swap-oob="innerHTML">
          <BookListContent books={result.books} />
        </div>
      </>
    )
  }

  return c.html(
    <>
      <ResultMessage message={result.message} tone="success" />
      <input
        id="isbn-input"
        name="isbn"
        placeholder="例: 9784003101018"
        class="w-full rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-base outline-none transition focus:border-emerald-600 focus:ring-4 focus:ring-emerald-100"
        hx-swap-oob="outerHTML"
      />
      <div id="book-list" hx-swap-oob="innerHTML">
        <BookListContent books={result.books} highlightNewest />
      </div>
    </>
  )
})

export default app
