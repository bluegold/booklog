export type UserRow = {
  id: number
  google_sub: string
  email: string
  name: string | null
  picture_url: string | null
}

export const upsertUserByGoogleSub = async (
  db: D1Database,
  input: { googleSub: string; email: string; name: string; pictureUrl?: string | undefined }
): Promise<UserRow> => {
  await db
    .prepare(
      `INSERT INTO users (google_sub, email, name, picture_url)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(google_sub) DO UPDATE SET
         email = excluded.email,
         name = excluded.name,
         picture_url = excluded.picture_url`
    )
    .bind(input.googleSub, input.email, input.name, input.pictureUrl ?? null)
    .run()

  const result = await db
    .prepare('SELECT id, google_sub, email, name, picture_url FROM users WHERE google_sub = ? LIMIT 1')
    .bind(input.googleSub)
    .first<UserRow>()

  if (!result) {
    throw new Error('Failed to load upserted user')
  }

  return result
}
