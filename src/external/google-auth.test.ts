import { afterEach, describe, expect, it, vi } from 'vitest'
import { buildGoogleAuthUrl, exchangeCodeForAccessToken, fetchGoogleUserInfo } from './google-auth.js'

describe('google-auth', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it('buildGoogleAuthUrl builds expected endpoint and query parameters', () => {
    const url = buildGoogleAuthUrl(
      {
        clientId: 'google-client-id',
        clientSecret: 'unused-in-auth-url',
        redirectUri: 'https://example.com/auth/google/callback',
      },
      'state-value'
    )

    const parsed = new URL(url)

    expect(parsed.origin + parsed.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(parsed.searchParams.get('client_id')).toBe('google-client-id')
    expect(parsed.searchParams.get('redirect_uri')).toBe('https://example.com/auth/google/callback')
    expect(parsed.searchParams.get('response_type')).toBe('code')
    expect(parsed.searchParams.get('scope')).toBe('openid email profile')
    expect(parsed.searchParams.get('state')).toBe('state-value')
    expect(parsed.searchParams.get('access_type')).toBe('online')
    expect(parsed.searchParams.get('prompt')).toBe('consent')
  })

  it('exchangeCodeForAccessToken returns null when token endpoint returns non-ok', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false })
    vi.stubGlobal('fetch', fetchMock)

    const result = await exchangeCodeForAccessToken(
      {
        clientId: 'cid',
        clientSecret: 'secret',
        redirectUri: 'https://example.com/callback',
      },
      'auth-code'
    )

    expect(result).toBeNull()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://oauth2.googleapis.com/token',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('exchangeCodeForAccessToken returns null when response has no access_token', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ token_type: 'Bearer' }),
      })
    )

    const result = await exchangeCodeForAccessToken(
      {
        clientId: 'cid',
        clientSecret: 'secret',
        redirectUri: 'https://example.com/callback',
      },
      'auth-code'
    )

    expect(result).toBeNull()
  })

  it('exchangeCodeForAccessToken returns token when endpoint succeeds', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ access_token: 'token-123' }),
      })
    )

    const result = await exchangeCodeForAccessToken(
      {
        clientId: 'cid',
        clientSecret: 'secret',
        redirectUri: 'https://example.com/callback',
      },
      'auth-code'
    )

    expect(result).toBe('token-123')
  })

  it('fetchGoogleUserInfo returns null when userinfo endpoint returns non-ok', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))

    const result = await fetchGoogleUserInfo('access-token')

    expect(result).toBeNull()
  })

  it('fetchGoogleUserInfo returns null when required fields are missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ sub: 'sub-1', email: 'user@example.com' }),
      })
    )

    const result = await fetchGoogleUserInfo('access-token')

    expect(result).toBeNull()
  })

  it('fetchGoogleUserInfo returns profile without picture when picture is absent', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          sub: 'sub-1',
          email: 'user@example.com',
          name: 'Test User',
        }),
      })
    )

    const result = await fetchGoogleUserInfo('access-token')

    expect(result).toEqual({
      sub: 'sub-1',
      email: 'user@example.com',
      name: 'Test User',
    })
  })

  it('fetchGoogleUserInfo returns profile with picture when present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          sub: 'sub-1',
          email: 'user@example.com',
          name: 'Test User',
          picture: 'https://example.com/avatar.png',
        }),
      })
    )

    const result = await fetchGoogleUserInfo('access-token')

    expect(result).toEqual({
      sub: 'sub-1',
      email: 'user@example.com',
      name: 'Test User',
      picture: 'https://example.com/avatar.png',
    })
  })
})
