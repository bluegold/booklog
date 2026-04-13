export type Bindings = {
  DB: D1Database
  DEBUG_OPENBD?: string
}

export type Variables = {
  csrfToken: string
  parsedForm: FormData
}

export type AppEnv = {
  Bindings: Bindings
  Variables: Variables
}
