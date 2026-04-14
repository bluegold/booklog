export type BookRow = {
  id: number
  user_id: number
  isbn: string | null
  title: string | null
  author: string | null
  publisher: string | null
  published_at: string | null
  cover_url: string | null
  created_at: string | null
  updated_at?: string | null
}

export type UserRow = {
  id: number
  google_sub: string
  email: string
  name: string | null
  user_type: 'user' | 'admin'
  picture_url: string | null
  created_at: string | null
}

export type MockDbOptions = {
  initialBooks?: BookRow[]
  initialUsers?: UserRow[]
  insertError?: Error
  forceCoverUpdateNoChange?: boolean
  simulateConcurrentCoverUploadOnNextEditUpdate?: string
}

export type MockDbState = {
  books: BookRow[]
  users: UserRow[]
  nextBookId: number
  nextUserId: number
  didSimulateConcurrentCoverUploadOnEditUpdate: boolean
  options: MockDbOptions
}

