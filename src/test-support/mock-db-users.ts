import type { MockDbState } from './mock-db-types.js'

export const handleUsersRun = (sql: string, boundParams: unknown[], state: MockDbState) => {
  if (!sql.startsWith('INSERT INTO users (google_sub, email, name, picture_url)')) {
    return null
  }

  const googleSub = String(boundParams[0] ?? '')
  const email = String(boundParams[1] ?? '')
  const name = boundParams[2] != null ? String(boundParams[2]) : null
  const pictureUrl = boundParams[3] != null ? String(boundParams[3]) : null
  const existing = state.users.find((user) => user.google_sub === googleSub)

  if (existing) {
    existing.email = email
    existing.name = name
    existing.picture_url = pictureUrl
    return { success: true, meta: { changes: 1 } }
  }

  state.users.push({
    id: state.nextUserId,
    google_sub: googleSub,
    email,
    name,
    user_type: 'user',
    picture_url: pictureUrl,
    created_at: '2026-04-13 10:00:00',
  })
  state.nextUserId += 1
  return { success: true, meta: { changes: 1 } }
}

export const handleUsersAll = <T>(sql: string, boundParams: unknown[], state: MockDbState) => {
  if (!sql.startsWith('SELECT\n        users.id,')) {
    return null
  }

  const sortedUsers = [...state.users].sort((a, b) => {
    const timeA = new Date((a.created_at ?? '').replace(' ', 'T') + 'Z').getTime()
    const timeB = new Date((b.created_at ?? '').replace(' ', 'T') + 'Z').getTime()
    if (timeA !== timeB) {
      return timeB - timeA
    }

    return b.id - a.id
  })
  const results = sortedUsers.map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    user_type: user.user_type,
    book_count: state.books.filter((book) => book.user_id === user.id).length,
  }))
  return { results: results as T[] }
}

export const handleUsersFirst = <T>(sql: string, boundParams: unknown[], state: MockDbState) => {
  if (sql.startsWith('SELECT id, google_sub, email, name, user_type, picture_url FROM users WHERE id = ? LIMIT 1')) {
    const userId = Number(boundParams[0] ?? 0)
    const row = state.users.find((user) => user.id === userId)
    return (row ?? null) as T | null
  }

  if (sql.startsWith('SELECT id, google_sub, email, name, user_type, picture_url FROM users WHERE google_sub = ? LIMIT 1')) {
    const googleSub = String(boundParams[0] ?? '')
    const row = state.users.find((user) => user.google_sub === googleSub)
    return (row ?? null) as T | null
  }

  return null
}
