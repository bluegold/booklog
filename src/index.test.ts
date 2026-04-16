import { beforeEach, describe, expect, it, vi } from 'vitest'
import app from './index.js'
import { COVER_UPLOAD_REQUEST_SIZE_ERROR_MESSAGE } from './services/cover-policy.js'
import { createSessionToken } from './security/session.js'
import { createMockDb, type BookRow } from './test-support/mock-db.js'

type SessionUserOptions = {
  id?: number
  email?: string
  name?: string
  userType?: 'user' | 'admin'
  impersonator?: {
    id: number
    email: string
    name: string
  }
}

type CsrfContext = {
  token: string
  csrfCookie: string
  sessionCookie: string
}

const TEST_SESSION_SECRET = 'test-session-secret'

const createMockR2Bucket = (): R2Bucket => {
  return {
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  } as unknown as R2Bucket
}

const createSessionCookie = async (options: SessionUserOptions = {}): Promise<string> => {
  const token = await createSessionToken(TEST_SESSION_SECRET, {
    id: options.id ?? 1,
    email: options.email ?? 'tester@example.com',
    name: options.name ?? 'Tester',
    userType: options.userType ?? 'user',
    ...(options.impersonator ? { impersonator: options.impersonator } : {}),
  })

  return `session_token=${token}`
}

const fetchCsrfContext = async (): Promise<CsrfContext> => {
  const sessionCookie = await createSessionCookie()
  return fetchCsrfContextForSession(sessionCookie)
}

const fetchCsrfContextForSession = async (sessionCookie: string): Promise<CsrfContext> => {
  const res = await app.request(
    '/',
    {
      headers: {
        Cookie: sessionCookie,
      },
    },
    { SESSION_SECRET: TEST_SESSION_SECRET }
  )
  const body = await res.text()

  const tokenMatch = body.match(/name="csrf_token" value="([^"]+)"/)
  const cookieHeader = res.headers.get('set-cookie')

  const token = tokenMatch?.[1]
  const csrfCookie = cookieHeader?.split(';')[0]

  if (!token || !csrfCookie) {
    throw new Error('CSRF context was not issued')
  }

  return {
    token,
    csrfCookie,
    sessionCookie,
  }
}

type OpenBdResponse = Array<
  { summary?: { title?: string; author?: string; publisher?: string; pubdate?: string; cover?: string } } | null
>

const mockOpenBdFound = (
  title: string,
  author = '著者テスト',
  publisher = '出版社テスト',
  pubdate = '198801',
  cover = 'https://example.com/cover.jpg'
): void => {
  const body: OpenBdResponse = [{ summary: { title, author, publisher, pubdate, cover } }]
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => body }))
}

const mockOpenBdNotFound = (): void => {
  const body: OpenBdResponse = [null]
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => body }))
}

describe('reading log routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('GET / returns top page with form and list container', async () => {
    const res = await app.request('/')
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('Reading Log')
    expect(body).not.toContain('hx-post="/books"')
    expect(body).not.toContain('hx-get="/books"')
    expect(body).not.toContain('name="csrf_token"')
    expect(body).toContain('Googleでログイン')
    expect(res.headers.get('set-cookie')).toContain('csrf_token=')
  })

  it('GET / shows admin dropdown when admin session', async () => {
    const db = createMockDb({
      initialUsers: [
        {
          id: 1,
          google_sub: 'admin-sub',
          email: 'admin@example.com',
          name: 'Admin User',
          user_type: 'admin',
          picture_url: null,
          created_at: '2026-04-14 09:00:00',
        },
      ],
    })
    const sessionCookie = await createSessionCookie({
      userType: 'admin',
      name: 'Admin User',
      email: 'admin@example.com',
    })

    const res = await app.request(
      '/',
      {
        headers: {
          Cookie: sessionCookie,
        },
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('<summary')
    expect(body).toContain('>管理<')
    expect(body).toContain('href="/admin/users"')
  })

  it('GET / hides admin dropdown when session says admin but DB role is revoked', async () => {
    const db = createMockDb({
      initialUsers: [
        {
          id: 1,
          google_sub: 'demoted-admin-sub',
          email: 'admin@example.com',
          name: 'Demoted Admin',
          user_type: 'user',
          picture_url: null,
          created_at: '2026-04-14 09:00:00',
        },
      ],
    })
    const sessionCookie = await createSessionCookie({
      id: 1,
      email: 'admin@example.com',
      name: 'Demoted Admin',
      userType: 'admin',
    })

    const res = await app.request(
      '/',
      {
        headers: {
          Cookie: sessionCookie,
        },
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).not.toContain('>管理<')
    expect(body).not.toContain('href="/admin/users"')
  })

  it('GET /admin/users returns 403 for non-admin user', async () => {
    const db = createMockDb()
    const sessionCookie = await createSessionCookie()

    const res = await app.request(
      '/admin/users',
      {
        headers: {
          Cookie: sessionCookie,
        },
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
    )
    const body = await res.text()

    expect(res.status).toBe(403)
    expect(body).toContain('管理者権限が必要です。')
  })

  it('GET /admin/users returns 403 when session says admin but DB role is revoked', async () => {
    const db = createMockDb({
      initialUsers: [
        {
          id: 1,
          google_sub: 'demoted-admin-sub',
          email: 'admin@example.com',
          name: 'Demoted Admin',
          user_type: 'user',
          picture_url: null,
          created_at: '2026-04-14 09:00:00',
        },
      ],
    })
    const sessionCookie = await createSessionCookie({
      id: 1,
      email: 'admin@example.com',
      name: 'Demoted Admin',
      userType: 'admin',
    })

    const res = await app.request(
      '/admin/users',
      {
        headers: {
          Cookie: sessionCookie,
        },
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
    )
    const body = await res.text()

    expect(res.status).toBe(403)
    expect(body).toContain('管理者権限が必要です。')
  })

  it('GET /admin/users lists users with book counts for admin', async () => {
    const db = createMockDb({
      initialUsers: [
        {
          id: 1,
          google_sub: 'admin-sub',
          email: 'admin@example.com',
          name: 'Admin',
          user_type: 'admin',
          picture_url: null,
          created_at: '2026-04-14 09:00:00',
        },
        {
          id: 2,
          google_sub: 'user-sub',
          email: 'user@example.com',
          name: 'Reader',
          user_type: 'user',
          picture_url: null,
          created_at: '2026-04-13 09:00:00',
        },
      ],
      initialBooks: [
        {
          id: 1,
          user_id: 2,
          isbn: '9784003101018',
          title: 'User Book 1',
          author: null,
          publisher: null,
          published_at: null,
          cover_url: null,
          created_at: '2026-04-13 10:00:00',
        },
        {
          id: 2,
          user_id: 2,
          isbn: '9784101010014',
          title: 'User Book 2',
          author: null,
          publisher: null,
          published_at: null,
          cover_url: null,
          created_at: '2026-04-13 11:00:00',
        },
      ],
    })
    const sessionCookie = await createSessionCookie({
      id: 1,
      email: 'admin@example.com',
      name: 'Admin',
      userType: 'admin',
    })

    const res = await app.request(
      '/admin/users',
      {
        headers: {
          Cookie: sessionCookie,
        },
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('ユーザ管理')
    expect(body).toContain('Reader')
    expect(body).toContain('>2<')
    expect(body).toContain('impersonate')
  })

  it('POST /admin/impersonate switches session to target user for admin', async () => {
    const db = createMockDb({
      initialUsers: [
        {
          id: 1,
          google_sub: 'admin-sub',
          email: 'admin@example.com',
          name: 'Admin',
          user_type: 'admin',
          picture_url: null,
          created_at: '2026-04-14 09:00:00',
        },
        {
          id: 2,
          google_sub: 'user-sub',
          email: 'user@example.com',
          name: 'Reader',
          user_type: 'user',
          picture_url: null,
          created_at: '2026-04-13 09:00:00',
        },
      ],
    })
    const csrf = await fetchCsrfContext()
    const adminSessionCookie = await createSessionCookie({
      id: 1,
      email: 'admin@example.com',
      name: 'Admin',
      userType: 'admin',
    })

    const res = await app.request(
      '/admin/impersonate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: `${adminSessionCookie}; ${csrf.csrfCookie}`,
        },
        body: new URLSearchParams({ csrf_token: csrf.token, target_user_id: '2' }),
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
    )

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/')

    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toContain('session_token=')

    const switchedSession = setCookie?.split(';')[0]
    const follow = await app.request(
      '/',
      {
        headers: {
          Cookie: switchedSession ?? '',
        },
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
    )
    const followBody = await follow.text()

    expect(follow.status).toBe(200)
    expect(followBody).toContain('Reader')
    expect(followBody).toContain('impersonate 中')
  })

  it('POST /admin/impersonate returns 401 when SESSION_SECRET is missing', async () => {
    const db = createMockDb({
      initialUsers: [
        {
          id: 1,
          google_sub: 'admin-sub',
          email: 'admin@example.com',
          name: 'Admin',
          user_type: 'admin',
          picture_url: null,
          created_at: '2026-04-14 09:00:00',
        },
      ],
    })
    const adminSessionCookie = await createSessionCookie({
      id: 1,
      email: 'admin@example.com',
      name: 'Admin',
      userType: 'admin',
    })
    const csrf = await fetchCsrfContextForSession(adminSessionCookie)

    const res = await app.request(
      '/admin/impersonate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: `${adminSessionCookie}; ${csrf.csrfCookie}`,
        },
        body: new URLSearchParams({ csrf_token: csrf.token, target_user_id: '2' }),
      },
      { DB: db }
    )
    const body = await res.text()

    expect(res.status).toBe(401)
    expect(body).toContain('ログインが必要です。')
  })

  it('POST /admin/impersonate returns 400 for invalid target user id', async () => {
    const db = createMockDb({
      initialUsers: [
        {
          id: 1,
          google_sub: 'admin-sub',
          email: 'admin@example.com',
          name: 'Admin',
          user_type: 'admin',
          picture_url: null,
          created_at: '2026-04-14 09:00:00',
        },
      ],
    })
    const adminSessionCookie = await createSessionCookie({
      id: 1,
      email: 'admin@example.com',
      name: 'Admin',
      userType: 'admin',
    })
    const csrf = await fetchCsrfContextForSession(adminSessionCookie)

    const res = await app.request(
      '/admin/impersonate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: `${adminSessionCookie}; ${csrf.csrfCookie}`,
        },
        body: new URLSearchParams({ csrf_token: csrf.token, target_user_id: 'not-a-number' }),
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
    )
    const body = await res.text()

    expect(res.status).toBe(400)
    expect(body).toContain('対象ユーザが不正です。')
  })

  it('POST /admin/impersonate returns 404 when target user does not exist', async () => {
    const db = createMockDb({
      initialUsers: [
        {
          id: 1,
          google_sub: 'admin-sub',
          email: 'admin@example.com',
          name: 'Admin',
          user_type: 'admin',
          picture_url: null,
          created_at: '2026-04-14 09:00:00',
        },
      ],
    })
    const adminSessionCookie = await createSessionCookie({
      id: 1,
      email: 'admin@example.com',
      name: 'Admin',
      userType: 'admin',
    })
    const csrf = await fetchCsrfContextForSession(adminSessionCookie)

    const res = await app.request(
      '/admin/impersonate',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: `${adminSessionCookie}; ${csrf.csrfCookie}`,
        },
        body: new URLSearchParams({ csrf_token: csrf.token, target_user_id: '999' }),
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
    )
    const body = await res.text()

    expect(res.status).toBe(404)
    expect(body).toContain('対象ユーザが見つかりません。')
  })

  it('POST /admin/impersonate/stop returns 401 when SESSION_SECRET is missing', async () => {
    const db = createMockDb({
      initialUsers: [
        {
          id: 1,
          google_sub: 'admin-sub',
          email: 'admin@example.com',
          name: 'Admin',
          user_type: 'admin',
          picture_url: null,
          created_at: '2026-04-14 09:00:00',
        },
      ],
    })
    const impersonatedSessionCookie = await createSessionCookie({
      id: 2,
      email: 'user@example.com',
      name: 'Reader',
      userType: 'user',
      impersonator: {
        id: 1,
        email: 'admin@example.com',
        name: 'Admin',
      },
    })
    const csrf = await fetchCsrfContextForSession(impersonatedSessionCookie)

    const res = await app.request(
      '/admin/impersonate/stop',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: `${impersonatedSessionCookie}; ${csrf.csrfCookie}`,
        },
        body: new URLSearchParams({ csrf_token: csrf.token }),
      },
      { DB: db }
    )
    const body = await res.text()

    expect(res.status).toBe(401)
    expect(body).toContain('ログインが必要です。')
  })

  it('POST /admin/impersonate/stop restores admin session from impersonated session', async () => {
    const db = createMockDb({
      initialUsers: [
        {
          id: 1,
          google_sub: 'admin-sub',
          email: 'admin@example.com',
          name: 'Admin',
          user_type: 'admin',
          picture_url: null,
          created_at: '2026-04-14 09:00:00',
        },
        {
          id: 2,
          google_sub: 'user-sub',
          email: 'user@example.com',
          name: 'Reader',
          user_type: 'user',
          picture_url: null,
          created_at: '2026-04-13 09:00:00',
        },
      ],
    })
    const impersonatedSessionCookie = await createSessionCookie({
      id: 2,
      email: 'user@example.com',
      name: 'Reader',
      userType: 'user',
      impersonator: {
        id: 1,
        email: 'admin@example.com',
        name: 'Admin',
      },
    })
    const csrf = await fetchCsrfContextForSession(impersonatedSessionCookie)

    const res = await app.request(
      '/admin/impersonate/stop',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: `${impersonatedSessionCookie}; ${csrf.csrfCookie}`,
        },
        body: new URLSearchParams({ csrf_token: csrf.token }),
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
    )

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/')

    const setCookie = res.headers.get('set-cookie')
    expect(setCookie).toContain('session_token=')

    const restoredSession = setCookie?.split(';')[0]
    const follow = await app.request(
      '/',
      {
        headers: {
          Cookie: restoredSession ?? '',
        },
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
    )
    const followBody = await follow.text()

    expect(follow.status).toBe(200)
    expect(followBody).toContain('Admin')
    expect(followBody).not.toContain('impersonate 中')
  })

  it('GET /books rejects impersonation session when impersonator is demoted in DB', async () => {
    const db = createMockDb({
      initialUsers: [
        {
          id: 1,
          google_sub: 'demoted-admin-sub',
          email: 'admin@example.com',
          name: 'Demoted Admin',
          user_type: 'user',
          picture_url: null,
          created_at: '2026-04-14 09:00:00',
        },
        {
          id: 2,
          google_sub: 'target-user-sub',
          email: 'target@example.com',
          name: 'Target User',
          user_type: 'user',
          picture_url: null,
          created_at: '2026-04-13 09:00:00',
        },
      ],
      initialBooks: [
        {
          id: 1,
          user_id: 2,
          isbn: '9784003101018',
          title: 'Target Book',
          author: null,
          publisher: null,
          published_at: null,
          cover_url: null,
          created_at: '2026-04-13 10:00:00',
        },
      ],
    })
    const impersonationSessionCookie = await createSessionCookie({
      id: 2,
      email: 'target@example.com',
      name: 'Target User',
      userType: 'user',
      impersonator: {
        id: 1,
        email: 'admin@example.com',
        name: 'Demoted Admin',
      },
    })

    const res = await app.request(
      '/books',
      {
        headers: {
          Cookie: impersonationSessionCookie,
        },
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
    )
    const body = await res.text()

    expect(res.status).toBe(401)
    expect(body).toContain('ログインが必要です。')
    expect(res.headers.get('set-cookie')).toContain('session_token=')
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0')
  })

  it('GET / keeps session-clear cookie when csrf cookie is also issued', async () => {
    const db = createMockDb({
      initialUsers: [
        {
          id: 1,
          google_sub: 'demoted-admin-sub',
          email: 'admin@example.com',
          name: 'Demoted Admin',
          user_type: 'user',
          picture_url: null,
          created_at: '2026-04-14 09:00:00',
        },
      ],
    })
    const impersonationSessionCookie = await createSessionCookie({
      id: 2,
      email: 'target@example.com',
      name: 'Target User',
      userType: 'user',
      impersonator: {
        id: 1,
        email: 'admin@example.com',
        name: 'Demoted Admin',
      },
    })

    const res = await app.request(
      '/',
      {
        headers: {
          Cookie: impersonationSessionCookie,
        },
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
    )

    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(res.status).toBe(200)
    expect(setCookie).toContain('session_token=')
    expect(setCookie).toContain('Max-Age=0')
    expect(setCookie).toContain('csrf_token=')
  })

  it('GET /auth/google/start keeps session-clear cookie alongside oauth state cookie', async () => {
    const db = createMockDb({
      initialUsers: [
        {
          id: 1,
          google_sub: 'demoted-admin-sub',
          email: 'admin@example.com',
          name: 'Demoted Admin',
          user_type: 'user',
          picture_url: null,
          created_at: '2026-04-14 09:00:00',
        },
      ],
    })
    const impersonationSessionCookie = await createSessionCookie({
      id: 2,
      email: 'target@example.com',
      name: 'Target User',
      userType: 'user',
      impersonator: {
        id: 1,
        email: 'admin@example.com',
        name: 'Demoted Admin',
      },
    })

    const res = await app.request(
      '/auth/google/start',
      {
        headers: {
          Cookie: impersonationSessionCookie,
        },
      },
      {
        DB: db,
        SESSION_SECRET: TEST_SESSION_SECRET,
        GOOGLE_CLIENT_ID: 'test-client-id',
        GOOGLE_REDIRECT_URI: 'https://example.com/auth/google/callback',
      }
    )

    const cookies = res.headers.getSetCookie()
    const hasSessionClear = cookies.some((c) => c.startsWith('session_token=') && c.includes('Max-Age=0'))
    const hasOauthState = cookies.some((c) => c.startsWith('oauth_state='))
    expect(res.status).toBe(302)
    expect(hasSessionClear).toBe(true)
    expect(hasOauthState).toBe(true)
  })

  it('GET /auth/google/start returns 500 when OAuth config is missing', async () => {
    const res = await app.request('/auth/google/start', undefined, { SESSION_SECRET: TEST_SESSION_SECRET })
    const body = await res.text()

    expect(res.status).toBe(500)
    expect(body).toContain('Google OAuth の設定が不足しています。')
  })

  it('GET /auth/google/start logs config in debug mode', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const res = await app.request('/auth/google/start', undefined, {
      GOOGLE_CLIENT_ID: 'debug-client-id',
      GOOGLE_REDIRECT_URI: 'https://example.com/auth/google/callback',
      DEBUG: '1',
    })

    expect(res.status).toBe(302)
    expect(logSpy).toHaveBeenCalledWith(
      '[oauth] /auth/google/start config',
      expect.objectContaining({ GOOGLE_REDIRECT_URI: 'https://example.com/auth/google/callback' })
    )
  })

  it('GET /auth/google/callback returns 500 when callback OAuth config is missing', async () => {
    const res = await app.request('/auth/google/callback?state=s&code=c', undefined, {
      GOOGLE_CLIENT_ID: 'only-client-id',
      GOOGLE_REDIRECT_URI: 'https://example.com/auth/google/callback',
    })
    const body = await res.text()

    expect(res.status).toBe(500)
    expect(body).toContain('Google OAuth の設定が不足しています。')
  })

  it('GET /auth/google/callback returns 400 when state validation fails', async () => {
    const res = await app.request(
      '/auth/google/callback?state=expected-state&code=auth-code',
      {
        headers: {
          Cookie: 'oauth_state=another-state',
        },
      },
      {
        GOOGLE_CLIENT_ID: 'client-id',
        GOOGLE_CLIENT_SECRET: 'client-secret',
        GOOGLE_REDIRECT_URI: 'https://example.com/auth/google/callback',
        SESSION_SECRET: TEST_SESSION_SECRET,
      }
    )
    const body = await res.text()

    expect(res.status).toBe(400)
    expect(body).toContain('Google 認証の state 検証に失敗しました。')
    expect(res.headers.get('set-cookie')).toContain('oauth_state=')
    expect(res.headers.get('set-cookie')).toContain('Max-Age=0')
  })

  it('GET /auth/google/callback returns 400 when token exchange fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    const res = await app.request(
      '/auth/google/callback?state=ok-state&code=auth-code',
      {
        headers: {
          Cookie: 'oauth_state=ok-state',
        },
      },
      {
        GOOGLE_CLIENT_ID: 'client-id',
        GOOGLE_CLIENT_SECRET: 'client-secret',
        GOOGLE_REDIRECT_URI: 'https://example.com/auth/google/callback',
        SESSION_SECRET: TEST_SESSION_SECRET,
      }
    )
    const body = await res.text()

    expect(res.status).toBe(400)
    expect(body).toContain('Google からのトークン取得に失敗しました。')
  })

  it('GET /auth/google/callback returns 400 when userinfo fetch fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'token-123' }) })
        .mockResolvedValueOnce({ ok: false })
    )

    const res = await app.request(
      '/auth/google/callback?state=ok-state&code=auth-code',
      {
        headers: {
          Cookie: 'oauth_state=ok-state',
        },
      },
      {
        GOOGLE_CLIENT_ID: 'client-id',
        GOOGLE_CLIENT_SECRET: 'client-secret',
        GOOGLE_REDIRECT_URI: 'https://example.com/auth/google/callback',
        SESSION_SECRET: TEST_SESSION_SECRET,
      }
    )
    const body = await res.text()

    expect(res.status).toBe(400)
    expect(body).toContain('Google ユーザー情報の取得に失敗しました。')
  })

  it('GET /auth/google/callback logs in user and redirects on success', async () => {
    const db = createMockDb()
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce({ ok: true, json: async () => ({ access_token: 'token-123' }) })
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            sub: 'google-sub-success',
            email: 'oauth-user@example.com',
            name: 'OAuth User',
            picture: 'https://example.com/avatar.png',
          }),
        })
    )

    const res = await app.request(
      '/auth/google/callback?state=ok-state&code=auth-code',
      {
        headers: {
          Cookie: 'oauth_state=ok-state',
        },
      },
      {
        DB: db,
        GOOGLE_CLIENT_ID: 'client-id',
        GOOGLE_CLIENT_SECRET: 'client-secret',
        GOOGLE_REDIRECT_URI: 'https://example.com/auth/google/callback',
        SESSION_SECRET: TEST_SESSION_SECRET,
      }
    )

    const cookies = res.headers.getSetCookie()
    const hasSessionCookie = cookies.some((cookie) => cookie.startsWith('session_token='))
    const hasStateClearCookie = cookies.some((cookie) => cookie.startsWith('oauth_state=') && cookie.includes('Max-Age=0'))

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/')
    expect(hasSessionCookie).toBe(true)
    expect(hasStateClearCookie).toBe(true)
  })

  it('GET /auth/google/callback logs config in debug mode', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

    const res = await app.request('/auth/google/callback?state=s&code=c', undefined, {
      GOOGLE_CLIENT_ID: 'client-id',
      GOOGLE_CLIENT_SECRET: 'client-secret',
      GOOGLE_REDIRECT_URI: 'https://example.com/auth/google/callback',
      SESSION_SECRET: TEST_SESSION_SECRET,
      DEBUG: '1',
    })

    expect(res.status).toBe(400)
    expect(logSpy).toHaveBeenCalledWith(
      '[oauth] /auth/google/callback config',
      expect.objectContaining({
        GOOGLE_CLIENT_SECRET: '(set)',
        SESSION_SECRET: '(set)',
      })
    )
  })

  it('POST /auth/logout clears session cookie when CSRF token is valid', async () => {
    const csrf = await fetchCsrfContext()

    const res = await app.request(
      '/auth/logout',
      {
        method: 'POST',
        headers: {
          Cookie: `${csrf.sessionCookie}; ${csrf.csrfCookie}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({ csrf_token: csrf.token }),
      },
      { SESSION_SECRET: TEST_SESSION_SECRET }
    )

    const setCookie = res.headers.get('set-cookie') ?? ''
    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('/')
    expect(setCookie).toContain('session_token=')
    expect(setCookie).toContain('Max-Age=0')
  })

  it('GET /books returns 401 when not authenticated', async () => {
    const db = createMockDb()
    const res = await app.request('/books', undefined, { DB: db })
    const body = await res.text()

    expect(res.status).toBe(401)
    expect(body).toContain('ログインが必要です。')
  })

  it('GET /books returns empty-state message when authenticated and no books exist', async () => {
    const db = createMockDb()
    const sessionCookie = await createSessionCookie()
    const res = await app.request(
      '/books',
      {
        headers: {
          Cookie: sessionCookie,
        },
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('まだ登録がありません。')
  })

  it('GET /books filters list by query', async () => {
    const db = createMockDb({
      initialBooks: [
        {
          id: 1,
          user_id: 1,
          isbn: '9784003101018',
          title: '吾輩は猫である',
          author: '夏目漱石',
          publisher: '岩波書店',
          published_at: '1905-11',
          cover_url: null,
          created_at: '2026-04-13 09:00:00',
        },
        {
          id: 2,
          user_id: 1,
          isbn: '9784101010014',
          title: 'こころ',
          author: '夏目漱石',
          publisher: '新潮文庫',
          published_at: '1914',
          cover_url: null,
          created_at: '2026-04-12 09:00:00',
        },
      ],
    })
    const sessionCookie = await createSessionCookie()

    const res = await app.request(
      '/books?q=%E7%8C%AB',
      {
        headers: {
          Cookie: sessionCookie,
        },
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('吾輩は猫である')
    expect(body).not.toContain('こころ')
    expect(body).toContain('検索結果 1 件')
  })

  it('GET /books paginates list by page query', async () => {
    const initialBooks: BookRow[] = Array.from({ length: 11 }, (_, index) => ({
      id: index + 1,
      user_id: 1,
      isbn: `97840000000${String(index + 1).padStart(2, '0')}`,
      title: `Book ${index + 1}`,
      author: 'Tester',
      publisher: 'Pub',
      published_at: null,
      cover_url: null,
      created_at: `2026-04-${String(13 - index).padStart(2, '0')} 09:00:00`,
    }))
    const db = createMockDb({ initialBooks })
    const sessionCookie = await createSessionCookie()

    const res = await app.request(
      '/books?page=2',
      {
        headers: {
          Cookie: sessionCookie,
        },
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('2 / 2 ページ')
    expect(body).toContain('Book 11')
    expect(body).not.toContain('Book 10')
  })

  it('GET /books can find matches beyond first 50 rows', async () => {
    const initialBooks: BookRow[] = Array.from({ length: 60 }, (_, index) => ({
      id: index + 1,
      user_id: 1,
      isbn: `9784999999${String(index + 1).padStart(4, '0')}`,
      title: index === 59 ? 'Needle Book' : `Book ${index + 1}`,
      author: 'Tester',
      publisher: 'Pub',
      published_at: null,
      cover_url: null,
      created_at: `2026-02-${String((index % 28) + 1).padStart(2, '0')} 09:00:00`,
    }))
    const db = createMockDb({ initialBooks })
    const sessionCookie = await createSessionCookie()

    const res = await app.request(
      '/books?q=needle',
      {
        headers: {
          Cookie: sessionCookie,
        },
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('Needle Book')
    expect(body).toContain('検索結果 1 件')
  })

  it('POST /books rejects request when not authenticated', async () => {
    const db = createMockDb()

    const res = await app.request(
      '/books',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ isbn: '9784003101018' }),
      },
      { DB: db }
    )

    const body = await res.text()
    expect(res.status).toBe(401)
    expect(body).toContain('ログインが必要です。')
  })

  it('POST /books rejects request when CSRF token is missing', async () => {
    const db = createMockDb()
    const sessionCookie = await createSessionCookie()

    const res = await app.request(
      '/books',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: sessionCookie,
        },
        body: new URLSearchParams({ isbn: '9784003101018' }),
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
    )

    const body = await res.text()
    expect(res.status).toBe(403)
    expect(body).toContain('不正なリクエストです。ページを再読み込みしてやり直してください。')
  })

  it('POST /books returns validation error for invalid ISBN format', async () => {
    const db = createMockDb()
    mockOpenBdNotFound()
    const csrf = await fetchCsrfContext()

    const res = await app.request(
      '/books',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: `${csrf.sessionCookie}; ${csrf.csrfCookie}`,
        },
        body: new URLSearchParams({ isbn: 'abc', csrf_token: csrf.token }),
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('ISBN形式が不正です（10桁または13桁）')
  })

  it('POST /books registers book with metadata from openBD', async () => {
    const db = createMockDb()
    mockOpenBdFound('吾輩は猫である', '夏目漱石', '岩波書店', '1905-11', 'https://example.com/wagahai.jpg')
    const csrf = await fetchCsrfContext()

    const res = await app.request(
      '/books',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: `${csrf.sessionCookie}; ${csrf.csrfCookie}`,
        },
        body: new URLSearchParams({ isbn: '9784003101018', csrf_token: csrf.token }),
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('登録しました')
    expect(body).toContain('吾輩は猫である')
    expect(body).toContain('出版日: 1905-11')
    expect(body).toContain('https://example.com/wagahai.jpg')
  })

  it('POST /books returns duplicate ISBN error for unique constraint violations', async () => {
    const db = createMockDb({
      initialBooks: [
        {
          id: 1,
          user_id: 1,
          isbn: '9784003101018',
          title: null,
          author: null,
          publisher: null,
          published_at: null,
          cover_url: null,
          created_at: '2026-04-13 09:00:00',
        },
      ],
      insertError: new Error('D1_ERROR: UNIQUE constraint failed: books.user_id, books.isbn: SQLITE_CONSTRAINT (extended: SQLITE_CONSTRAINT_UNIQUE)'),
    })
    mockOpenBdFound('重複テスト本')
    const csrf = await fetchCsrfContext()

    const res = await app.request(
      '/books',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: `${csrf.sessionCookie}; ${csrf.csrfCookie}`,
        },
        body: new URLSearchParams({ isbn: '978-4003101018', csrf_token: csrf.token }),
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('この ISBN は既に登録されています: 9784003101018')
    expect(body).toContain('hx-swap-oob="innerHTML"')
  })

  it('POST /books shows manual entry form when metadata lookup fails', async () => {
    const db = createMockDb()
    mockOpenBdNotFound()
    const csrf = await fetchCsrfContext()

    const res = await app.request(
      '/books',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: `${csrf.sessionCookie}; ${csrf.csrfCookie}`,
        },
        body: new URLSearchParams({ isbn: '9784003101018', csrf_token: csrf.token }),
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('手入力で登録してください')
    expect(body).toContain('hx-post="/books/manual"')
  })

  it('GET /books/:id/edit returns inline edit form for own book', async () => {
    const db = createMockDb({
      initialBooks: [
        {
          id: 10,
          user_id: 1,
          isbn: '9784003101018',
          title: '編集前タイトル',
          author: '著者',
          publisher: '出版社',
          published_at: '2000',
          cover_url: null,
          created_at: '2026-04-13 09:00:00',
        },
      ],
    })
    const csrf = await fetchCsrfContext()

    const res = await app.request(
      '/books/10/edit?q=&page=1',
      {
        headers: {
          Cookie: `${csrf.sessionCookie}; ${csrf.csrfCookie}`,
        },
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('編集前タイトル')
    expect(body).toContain('hx-post="/books/10/edit"')
  })

  it('POST /books/:id/edit updates metadata and returns success', async () => {
    const db = createMockDb({
      initialBooks: [
        {
          id: 10,
          user_id: 1,
          isbn: '9784003101018',
          title: '編集前タイトル',
          author: '著者',
          publisher: '出版社',
          published_at: '2000',
          cover_url: null,
          created_at: '2026-04-13 09:00:00',
        },
      ],
    })
    const csrf = await fetchCsrfContext()

    const res = await app.request(
      '/books/10/edit',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: `${csrf.sessionCookie}; ${csrf.csrfCookie}`,
        },
        body: new URLSearchParams({
          csrf_token: csrf.token,
          q: '',
          page: '1',
          title: '編集後タイトル',
          author: '編集後著者',
          publisher: '編集後出版社',
          published_at: '2020-01',
          cover_url: 'https://example.com/new.jpg',
        }),
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('更新しました')
    expect(body).toContain('編集後タイトル')
  })

  it('POST /books/:id/edit ignores cover_url changes when app-managed cover exists', async () => {
    const db = createMockDb({
      initialBooks: [
        {
          id: 10,
          user_id: 1,
          isbn: '9784003101018',
          title: '編集前タイトル',
          author: '著者',
          publisher: '出版社',
          published_at: '2000',
          cover_url: 'https://pub.example.r2.dev/users/1/books/10/current.jpg',
          created_at: '2026-04-13 09:00:00',
        },
      ],
    })
    const csrf = await fetchCsrfContext()

    const res = await app.request(
      '/books/10/edit',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: `${csrf.sessionCookie}; ${csrf.csrfCookie}`,
        },
        body: new URLSearchParams({
          csrf_token: csrf.token,
          q: '',
          page: '1',
          title: '編集後タイトル',
          author: '編集後著者',
          publisher: '編集後出版社',
          published_at: '2020-01',
          cover_url: 'https://pub.example.r2.dev/users/1/books/999/attack.jpg',
        }),
      },
      {
        DB: db,
        SESSION_SECRET: TEST_SESSION_SECRET,
        BOOK_COVERS_PUBLIC_BASE_URL: 'https://pub.example.r2.dev',
      }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('更新しました')
    expect(body).toContain('https://pub.example.r2.dev/users/1/books/10/current.jpg')
    expect(body).not.toContain('https://pub.example.r2.dev/users/1/books/999/attack.jpg')
  })

  it('POST /books/:id/edit preserves concurrently uploaded managed cover_url', async () => {
    const db = createMockDb({
      simulateConcurrentCoverUploadOnNextEditUpdate: 'https://pub.example.r2.dev/users/1/books/10/newly-uploaded.jpg',
      initialBooks: [
        {
          id: 10,
          user_id: 1,
          isbn: '9784003101018',
          title: '編集前タイトル',
          author: '著者',
          publisher: '出版社',
          published_at: '2000',
          cover_url: null,
          created_at: '2026-04-13 09:00:00',
        },
      ],
    })
    const csrf = await fetchCsrfContext()

    const res = await app.request(
      '/books/10/edit',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: `${csrf.sessionCookie}; ${csrf.csrfCookie}`,
        },
        body: new URLSearchParams({
          csrf_token: csrf.token,
          q: '',
          page: '1',
          title: '編集後タイトル',
          author: '編集後著者',
          publisher: '編集後出版社',
          published_at: '2020-01',
          cover_url: 'https://example.com/attack.jpg',
        }),
      },
      {
        DB: db,
        SESSION_SECRET: TEST_SESSION_SECRET,
        BOOK_COVERS_PUBLIC_BASE_URL: 'https://pub.example.r2.dev',
      }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('更新しました')
    expect(body).toContain('https://pub.example.r2.dev/users/1/books/10/newly-uploaded.jpg')
    expect(body).not.toContain('https://example.com/attack.jpg')
  })

  it('POST /books/:id/cover uploads image and returns success', async () => {
    const db = createMockDb({
      initialBooks: [
        {
          id: 10,
          user_id: 1,
          isbn: '9784003101018',
          title: 'カバー更新前',
          author: '著者',
          publisher: '出版社',
          published_at: '2000',
          cover_url: 'https://pub.example.r2.dev/users/1/books/10/old-cover.jpg',
          created_at: '2026-04-13 09:00:00',
        },
      ],
    })
    const bucket = createMockR2Bucket()
    const csrf = await fetchCsrfContext()
    const form = new FormData()
    form.set('csrf_token', csrf.token)
    form.set('q', '')
    form.set('page', '1')
    form.set('cover_image', new File(['fake-image'], 'cover.jpg', { type: 'image/jpeg' }))

    const res = await app.request(
      '/books/10/cover',
      {
        method: 'POST',
        headers: {
          Cookie: `${csrf.sessionCookie}; ${csrf.csrfCookie}`,
          'Content-Length': '1024',
        },
        body: form,
      },
      {
        DB: db,
        SESSION_SECRET: TEST_SESSION_SECRET,
        BOOK_COVERS: bucket,
        BOOK_COVERS_PUBLIC_BASE_URL: 'https://pub.example.r2.dev',
      }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('書影画像を更新しました')
    expect(body).toContain('https://pub.example.r2.dev/users/1/books/10/')
    expect(bucket.put).toHaveBeenCalledTimes(1)
    expect(bucket.delete).toHaveBeenCalledWith('users/1/books/10/old-cover.jpg')
  })

  it('POST /books/:id/cover rejects oversized payload before multipart parsing', async () => {
    const db = createMockDb({
      initialBooks: [
        {
          id: 10,
          user_id: 1,
          isbn: '9784003101018',
          title: 'カバー更新前',
          author: '著者',
          publisher: '出版社',
          published_at: '2000',
          cover_url: null,
          created_at: '2026-04-13 09:00:00',
        },
      ],
    })
    const bucket = createMockR2Bucket()
    const csrf = await fetchCsrfContext()

    const res = await app.request(
      '/books/10/cover',
      {
        method: 'POST',
        headers: {
          Cookie: `${csrf.sessionCookie}; ${csrf.csrfCookie}`,
          'Content-Type': 'multipart/form-data; boundary=----x',
          'Content-Length': String(2 * 1024 * 1024 + 128 * 1024 + 1),
        },
        body: '------x--',
      },
      {
        DB: db,
        SESSION_SECRET: TEST_SESSION_SECRET,
        BOOK_COVERS: bucket,
        BOOK_COVERS_PUBLIC_BASE_URL: 'https://pub.example.r2.dev',
      }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain(COVER_UPLOAD_REQUEST_SIZE_ERROR_MESSAGE)
    expect(bucket.put).not.toHaveBeenCalled()
  })

  it('POST /books/:id/cover rejects oversized payload when Content-Length is malformed', async () => {
    const db = createMockDb({
      initialBooks: [
        {
          id: 10,
          user_id: 1,
          isbn: '9784003101018',
          title: 'カバー更新前',
          author: '著者',
          publisher: '出版社',
          published_at: '2000',
          cover_url: null,
          created_at: '2026-04-13 09:00:00',
        },
      ],
    })
    const bucket = createMockR2Bucket()
    const csrf = await fetchCsrfContext()

    const oversizedBody = 'x'.repeat(2 * 1024 * 1024 + 128 * 1024 + 1)

    const res = await app.request(
      '/books/10/cover',
      {
        method: 'POST',
        headers: {
          Cookie: `${csrf.sessionCookie}; ${csrf.csrfCookie}`,
          'Content-Type': 'multipart/form-data; boundary=----x',
          'Content-Length': 'invalid-length',
        },
        body: oversizedBody,
      },
      {
        DB: db,
        SESSION_SECRET: TEST_SESSION_SECRET,
        BOOK_COVERS: bucket,
        BOOK_COVERS_PUBLIC_BASE_URL: 'https://pub.example.r2.dev',
      }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain(COVER_UPLOAD_REQUEST_SIZE_ERROR_MESSAGE)
    expect(bucket.put).not.toHaveBeenCalled()
  })

  it('POST /books/:id/cover rejects request when Content-Length is missing', async () => {
    const db = createMockDb({
      initialBooks: [
        {
          id: 10,
          user_id: 1,
          isbn: '9784003101018',
          title: 'カバー更新前',
          author: '著者',
          publisher: '出版社',
          published_at: '2000',
          cover_url: null,
          created_at: '2026-04-13 09:00:00',
        },
      ],
    })
    const bucket = createMockR2Bucket()
    const csrf = await fetchCsrfContext()

    const res = await app.request(
      '/books/10/cover',
      {
        method: 'POST',
        headers: {
          Cookie: `${csrf.sessionCookie}; ${csrf.csrfCookie}`,
          'Content-Type': 'multipart/form-data; boundary=----x',
        },
        body: '------x--',
      },
      {
        DB: db,
        SESSION_SECRET: TEST_SESSION_SECRET,
        BOOK_COVERS: bucket,
        BOOK_COVERS_PUBLIC_BASE_URL: 'https://pub.example.r2.dev',
      }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain(COVER_UPLOAD_REQUEST_SIZE_ERROR_MESSAGE)
    expect(bucket.put).not.toHaveBeenCalled()
  })

  it('POST /books/:id/cover cleans uploaded object when cover update keeps conflicting', async () => {
    const db = createMockDb({
      forceCoverUpdateNoChange: true,
      initialBooks: [
        {
          id: 10,
          user_id: 1,
          isbn: '9784003101018',
          title: 'カバー更新前',
          author: '著者',
          publisher: '出版社',
          published_at: '2000',
          cover_url: 'https://pub.example.r2.dev/users/1/books/10/current.jpg',
          created_at: '2026-04-13 09:00:00',
        },
      ],
    })
    const bucket = createMockR2Bucket()
    const csrf = await fetchCsrfContext()
    const form = new FormData()
    form.set('csrf_token', csrf.token)
    form.set('q', '')
    form.set('page', '1')
    form.set('cover_image', new File(['fake-image'], 'cover.jpg', { type: 'image/jpeg' }))

    const res = await app.request(
      '/books/10/cover',
      {
        method: 'POST',
        headers: {
          Cookie: `${csrf.sessionCookie}; ${csrf.csrfCookie}`,
          'Content-Length': '1024',
        },
        body: form,
      },
      {
        DB: db,
        SESSION_SECRET: TEST_SESSION_SECRET,
        BOOK_COVERS: bucket,
        BOOK_COVERS_PUBLIC_BASE_URL: 'https://pub.example.r2.dev',
      }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('書影更新中に競合が発生しました。もう一度お試しください。')
    expect(bucket.put).toHaveBeenCalledTimes(3)
    expect(bucket.delete).toHaveBeenCalledTimes(3)
  })

  it('POST /books/:id/cover returns error when file is missing', async () => {
    const db = createMockDb({
      initialBooks: [
        {
          id: 10,
          user_id: 1,
          isbn: '9784003101018',
          title: 'カバー更新前',
          author: '著者',
          publisher: '出版社',
          published_at: '2000',
          cover_url: null,
          created_at: '2026-04-13 09:00:00',
        },
      ],
    })
    const bucket = createMockR2Bucket()
    const csrf = await fetchCsrfContext()
    const form = new FormData()
    form.set('csrf_token', csrf.token)
    form.set('q', '')
    form.set('page', '1')

    const res = await app.request(
      '/books/10/cover',
      {
        method: 'POST',
        headers: {
          Cookie: `${csrf.sessionCookie}; ${csrf.csrfCookie}`,
          'Content-Length': '512',
        },
        body: form,
      },
      {
        DB: db,
        SESSION_SECRET: TEST_SESSION_SECRET,
        BOOK_COVERS: bucket,
        BOOK_COVERS_PUBLIC_BASE_URL: 'https://pub.example.r2.dev',
      }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('アップロードする画像ファイルを選択してください。')
    expect(bucket.put).not.toHaveBeenCalled()
  })

  it('POST /books/:id/delete removes the book and returns success', async () => {
    const db = createMockDb({
      initialBooks: [
        {
          id: 10,
          user_id: 1,
          isbn: '9784003101018',
          title: '削除対象',
          author: '著者',
          publisher: '出版社',
          published_at: '2000',
          cover_url: null,
          created_at: '2026-04-13 09:00:00',
        },
      ],
    })
    const csrf = await fetchCsrfContext()

    const res = await app.request(
      '/books/10/delete',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: `${csrf.sessionCookie}; ${csrf.csrfCookie}`,
        },
        body: new URLSearchParams({ csrf_token: csrf.token, q: '', page: '1' }),
      },
      { DB: db, SESSION_SECRET: TEST_SESSION_SECRET }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('削除しました')
    expect(body).not.toContain('削除対象')
  })

  it('POST /books/:id/delete removes managed cover object from R2 as best effort', async () => {
    const db = createMockDb({
      initialBooks: [
        {
          id: 10,
          user_id: 1,
          isbn: '9784003101018',
          title: '削除対象',
          author: '著者',
          publisher: '出版社',
          published_at: '2000',
          cover_url: 'https://pub.example.r2.dev/users/1/books/10/current.jpg',
          created_at: '2026-04-13 09:00:00',
        },
      ],
    })
    const bucket = createMockR2Bucket()
    const csrf = await fetchCsrfContext()

    const res = await app.request(
      '/books/10/delete',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Cookie: `${csrf.sessionCookie}; ${csrf.csrfCookie}`,
        },
        body: new URLSearchParams({ csrf_token: csrf.token, q: '', page: '1' }),
      },
      {
        DB: db,
        SESSION_SECRET: TEST_SESSION_SECRET,
        BOOK_COVERS: bucket,
        BOOK_COVERS_PUBLIC_BASE_URL: 'https://pub.example.r2.dev',
      }
    )
    const body = await res.text()

    expect(res.status).toBe(200)
    expect(body).toContain('削除しました')
    expect(bucket.delete).toHaveBeenCalledWith('users/1/books/10/current.jpg')
  })
})
