type GoogleOAuthConfig = {
  clientId: string
  clientSecret: string
  redirectUri: string
}

export type GoogleUserInfo = {
  sub: string
  email: string
  name: string
  picture?: string | undefined
}

const GOOGLE_AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_ENDPOINT = 'https://openidconnect.googleapis.com/v1/userinfo'

export const buildGoogleAuthUrl = (config: GoogleOAuthConfig, state: string): string => {
  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'consent',
  })

  return `${GOOGLE_AUTH_ENDPOINT}?${params.toString()}`
}

export const exchangeCodeForAccessToken = async (config: GoogleOAuthConfig, code: string): Promise<string | null> => {
  const body = new URLSearchParams({
    code,
    client_id: config.clientId,
    client_secret: config.clientSecret,
    redirect_uri: config.redirectUri,
    grant_type: 'authorization_code',
  })

  const response = await fetch(GOOGLE_TOKEN_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
  })

  if (!response.ok) {
    return null
  }

  const tokenResponse = (await response.json()) as { access_token?: string }
  return tokenResponse.access_token ?? null
}

export const fetchGoogleUserInfo = async (accessToken: string): Promise<GoogleUserInfo | null> => {
  const response = await fetch(GOOGLE_USERINFO_ENDPOINT, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  if (!response.ok) {
    return null
  }

  const data = (await response.json()) as Partial<GoogleUserInfo>
  if (!data.sub || !data.email || !data.name) {
    return null
  }

  return {
    sub: data.sub,
    email: data.email,
    name: data.name,
    ...(data.picture ? { picture: data.picture } : {}),
  }
}
