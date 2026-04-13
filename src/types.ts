export type Bindings = {
  DB: D1Database
  DEBUG?: string
  GOOGLE_CLIENT_ID?: string
  GOOGLE_CLIENT_SECRET?: string
  GOOGLE_REDIRECT_URI?: string
  SESSION_SECRET?: string
}

export type AuthUser = {
  id: number
  email: string
  name: string
  pictureUrl?: string | undefined
}

export type Variables = {
  csrfToken: string
  parsedForm: FormData
  authUser: AuthUser | null
}

export type AppEnv = {
  Bindings: Bindings
  Variables: Variables
}
