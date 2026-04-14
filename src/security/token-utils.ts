export const encodeBase64Url = (input: string): string => {
  return btoa(input).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export const decodeBase64Url = (input: string): string => {
  const padded = input.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((input.length + 3) % 4)
  return atob(padded)
}

export const parseCookies = (cookieHeader: string | null): Map<string, string> => {
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

export const constantTimeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) {
    return false
  }

  let mismatch = 0
  for (let i = 0; i < a.length; i += 1) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }

  return mismatch === 0
}

export const buildCookie = (name: string, value: string, maxAge: number, isSecure: boolean): string => {
  const secure = isSecure ? '; Secure' : ''
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure}`
}

export const createRandomBase64UrlToken = (byteLength: number): string => {
  const bytes = new Uint8Array(byteLength)
  crypto.getRandomValues(bytes)
  let binary = ''
  for (const byte of bytes) {
    binary += String.fromCharCode(byte)
  }

  return encodeBase64Url(binary)
}
