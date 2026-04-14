export type ListBooksOptions = {
  query?: string | undefined
  page?: number | undefined
  pageSize?: number | undefined
}

export type UpdateBookOptions = {
  managedCoverBaseUrl?: string | undefined
}

export type AddBookOptions = {
  debug?: boolean
}

export type SaveBookFieldsInput = {
  title?: string | undefined
  author?: string | undefined
  publisher?: string | undefined
  published_at?: string | undefined
  cover_url?: string | undefined
}

export type AddBookResult =
  | { status: 'validation-error'; message: string }
  | { status: 'not-found'; message: string; isbn: string }
  | { status: 'duplicate'; message: string }
  | { status: 'success'; message: string }

export type UpdateBookResult = { status: 'not-found'; message: string } | { status: 'conflict'; message: string } | { status: 'success'; message: string }
export type DeleteBookResult = { status: 'not-found'; message: string } | { status: 'success'; message: string }

export const duplicateIsbnMessages = ['UNIQUE constraint failed: books.isbn', 'UNIQUE constraint failed: books.user_id, books.isbn']
export const DEFAULT_PAGE_SIZE = 10
export const MAX_BOOK_EDIT_UPDATE_ATTEMPTS = 2

export const normalizeIsbn = (rawIsbn: string): string => rawIsbn.replace(/[\s-]/g, '')
export const isValidIsbn = (isbn: string): boolean => /^(?:\d{13}|\d{9}[\dXx])$/.test(isbn)
export const normalizeQuery = (rawQuery: string | undefined): string => rawQuery?.trim().toLowerCase() ?? ''

export const normalizeField = (raw: string | undefined): string | undefined => {
  const value = raw?.trim()
  return value ? value : undefined
}

export const normalizeBookFields = (input: SaveBookFieldsInput): SaveBookFieldsInput => {
  return {
    title: normalizeField(input.title),
    author: normalizeField(input.author),
    publisher: normalizeField(input.publisher),
    published_at: normalizeField(input.published_at),
    cover_url: normalizeField(input.cover_url),
  }
}

export const pickPage = (page: number | undefined): number => {
  if (!page || !Number.isFinite(page)) {
    return 1
  }

  return Math.max(1, Math.trunc(page))
}

export const pickPageSize = (pageSize: number | undefined): number => {
  if (!pageSize || !Number.isFinite(pageSize)) {
    return DEFAULT_PAGE_SIZE
  }

  return Math.min(50, Math.max(1, Math.trunc(pageSize)))
}
