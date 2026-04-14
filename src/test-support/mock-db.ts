import { handleBooksAll, handleBooksFirst, handleBooksRun } from './mock-db-books.js'
import { handleUsersAll, handleUsersFirst, handleUsersRun } from './mock-db-users.js'
import type { BookRow, MockDbOptions, MockDbState, UserRow } from './mock-db-types.js'

export type { BookRow, MockDbOptions, UserRow } from './mock-db-types.js'

const createInitialUsers = (initialUsers: UserRow[] | undefined): UserRow[] => {
  return [
    ...(initialUsers ?? [
      {
        id: 1,
        google_sub: 'google-sub-1',
        email: 'tester@example.com',
        name: 'Tester',
        user_type: 'user',
        picture_url: null,
        created_at: '2026-04-13 09:00:00',
      },
    ]),
  ]
}

const createMockDbState = (options: MockDbOptions): MockDbState => {
  const books: BookRow[] = [...(options.initialBooks ?? [])]
  const users: UserRow[] = createInitialUsers(options.initialUsers)

  return {
    books,
    users,
    nextBookId: books.length + 1,
    nextUserId: users.length + 1,
    didSimulateConcurrentCoverUploadOnEditUpdate: false,
    options,
  }
}

export const createMockDb = (options: MockDbOptions = {}): D1Database => {
  const state = createMockDbState(options)

  return {
    prepare(sql: string) {
      let boundParams: unknown[] = []

      return {
        bind(...params: unknown[]) {
          boundParams = params
          return this
        },
        async run() {
          const usersResult = handleUsersRun(sql, boundParams, state)
          if (usersResult) {
            return usersResult
          }

          return handleBooksRun(sql, boundParams, state)
        },
        async all<T>() {
          const usersResult = handleUsersAll<T>(sql, boundParams, state)
          if (usersResult) {
            return usersResult
          }

          return handleBooksAll<T>(sql, boundParams, state)
        },
        async first<T>() {
          const usersResult = handleUsersFirst<T>(sql, boundParams, state)
          if (usersResult !== null) {
            return usersResult
          }

          return handleBooksFirst<T>(sql, boundParams, state)
        },
      }
    },
  } as unknown as D1Database
}
