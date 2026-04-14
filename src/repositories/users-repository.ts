export type UserRow = {
  id: number
  google_sub: string
  email: string
  name: string | null
  user_type: 'user' | 'admin'
  picture_url: string | null
}

export type UserSummaryRow = {
  id: number
  email: string
  name: string | null
  user_type: 'user' | 'admin'
  book_count: number
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
    .prepare('SELECT id, google_sub, email, name, user_type, picture_url FROM users WHERE google_sub = ? LIMIT 1')
    .bind(input.googleSub)
    .first<UserRow>()

  if (!result) {
    throw new Error('Failed to load upserted user')
  }

  return result
}

export const findUserById = async (db: D1Database, userId: number): Promise<UserRow | null> => {
  const result = await db
    .prepare('SELECT id, google_sub, email, name, user_type, picture_url FROM users WHERE id = ? LIMIT 1')
    .bind(userId)
    .first<UserRow>()

  return result ?? null
}

export const listUsersWithBookCounts = async (db: D1Database): Promise<UserSummaryRow[]> => {
  const result = await db
    .prepare(
      `SELECT
        users.id,
        users.email,
        users.name,
        users.user_type,
        COUNT(books.id) AS book_count
      FROM users
      LEFT JOIN books ON books.user_id = users.id
      GROUP BY users.id, users.email, users.name, users.user_type
      ORDER BY users.created_at DESC, users.id DESC`
    )
    .all<UserSummaryRow>()

  return (result.results ?? []).map((row) => ({
    ...row,
    book_count: Number(row.book_count),
  }))
}
