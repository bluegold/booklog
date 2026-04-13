export type Bindings = {
  DB: D1Database
}

export type Variables = {
  csrfToken: string
  parsedForm: FormData
}

export type AppEnv = {
  Bindings: Bindings
  Variables: Variables
}
