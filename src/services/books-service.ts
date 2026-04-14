import {
  countBooks,
  deleteBookByIdForUser,
  fetchBookByIdForUser,
  fetchBooksPage,
  insertBook,
  type BookRow,
  updateBookByIdForUser,
} from '../repositories/books-repository.js'
import { fetchBookMetadataFromOpenBd } from '../external/openbd.js'
import { getManagedCoverObjectKeyForBook, isManagedCoverUrlForBook } from './cover-url-utils.js'

type AddBookOptions = {
  debug?: boolean
}

type ListBooksOptions = {
  query?: string | undefined
  page?: number | undefined
  pageSize?: number | undefined
}

type UpdateBookOptions = {
  managedCoverBaseUrl?: string | undefined
}

export type ListBooksResult = {
  books: BookRow[]
  query: string
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
}

type AddBookResult =
  | { status: 'validation-error'; message: string }
  | { status: 'not-found'; message: string; isbn: string }
  | { status: 'duplicate'; message: string }
  | { status: 'success'; message: string }

type SaveBookFieldsInput = {
  title?: string | undefined
  author?: string | undefined
  publisher?: string | undefined
  published_at?: string | undefined
  cover_url?: string | undefined
}

type UpdateBookResult = { status: 'not-found'; message: string } | { status: 'success'; message: string }
type DeleteBookResult = { status: 'not-found'; message: string } | { status: 'success'; message: string }

const duplicateIsbnMessages = ['UNIQUE constraint failed: books.isbn', 'UNIQUE constraint failed: books.user_id, books.isbn']
const DEFAULT_PAGE_SIZE = 10
const normalizeIsbn = (rawIsbn: string): string => rawIsbn.replace(/[\s-]/g, '')
const isValidIsbn = (isbn: string): boolean => /^(?:\d{13}|\d{9}[\dXx])$/.test(isbn)
const normalizeQuery = (rawQuery: string | undefined): string => rawQuery?.trim().toLowerCase() ?? ''
const normalizeField = (raw: string | undefined): string | undefined => {
  const value = raw?.trim()
  return value ? value : undefined
}

const normalizeBookFields = (input: SaveBookFieldsInput): SaveBookFieldsInput => {
  return {
    title: normalizeField(input.title),
    author: normalizeField(input.author),
    publisher: normalizeField(input.publisher),
    published_at: normalizeField(input.published_at),
    cover_url: normalizeField(input.cover_url),
  }
}

const pickPage = (page: number | undefined): number => {
  if (!page || !Number.isFinite(page)) {
    return 1
  }

  return Math.max(1, Math.trunc(page))
}

const pickPageSize = (pageSize: number | undefined): number => {
  if (!pageSize || !Number.isFinite(pageSize)) {
    return DEFAULT_PAGE_SIZE
  }

  return Math.min(50, Math.max(1, Math.trunc(pageSize)))
}

export const listBooks = async (db: D1Database, userId: number, options: ListBooksOptions = {}): Promise<ListBooksResult> => {
  const query = normalizeQuery(options.query)
  const pageSize = pickPageSize(options.pageSize)
  const requestedPage = pickPage(options.page)
  const totalCount = await countBooks(db, userId, query)
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const page = Math.min(requestedPage, totalPages)
  const offset = (page - 1) * pageSize
  const books = await fetchBooksPage(db, userId, query, pageSize, offset)

  return {
    books,
    query,
    page,
    pageSize,
    totalCount,
    totalPages,
  }
}

export const addBookByIsbn = async (
  db: D1Database,
  userId: number,
  rawIsbn: string | undefined,
  options: AddBookOptions = {}
): Promise<AddBookResult> => {
  const isbn = normalizeIsbn(rawIsbn?.trim() ?? '')

  if (!isbn) {
    return {
      status: 'validation-error',
      message: 'ISBN required',
    }
  }

  if (!isValidIsbn(isbn)) {
    return {
      status: 'validation-error',
      message: 'ISBN形式が不正です（10桁または13桁）',
    }
  }

  try {
    const metadata = await fetchBookMetadataFromOpenBd(isbn, options.debug === true)

    if (!metadata) {
      return {
        status: 'not-found',
        message: 'ISBN から書誌情報を取得できませんでした。手入力で登録してください。',
        isbn,
      }
    }

    const insertPayload = {
      user_id: userId,
      isbn,
      title: metadata?.title,
      author: metadata?.author,
      publisher: metadata?.publisher,
      published_at: metadata?.published_at,
      cover_url: metadata?.cover_url,
    }

    if (options.debug === true) {
      console.log('[books-service] insert payload', {
        isbn,
        hasMetadata: !!metadata,
        hasCoverUrl: !!insertPayload.cover_url,
        coverUrlPreview: insertPayload.cover_url?.slice(0, 120) ?? null,
        published_at: insertPayload.published_at ?? null,
      })
    }

    await insertBook(db, insertPayload)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)

    if (duplicateIsbnMessages.some((pattern) => message.includes(pattern))) {
      return {
        status: 'duplicate',
        message: `この ISBN は既に登録されています: ${isbn}`,
      }
    }

    throw error
  }

  return {
    status: 'success',
    message: `登録しました`,
  }
}

export type { AddBookResult }

export const getBookForEdit = async (db: D1Database, userId: number, bookId: number): Promise<BookRow | null> => {
  return fetchBookByIdForUser(db, userId, bookId)
}

export const addBookManual = async (
  db: D1Database,
  userId: number,
  rawIsbn: string | undefined,
  rawFields: SaveBookFieldsInput
): Promise<AddBookResult> => {
  const isbn = normalizeIsbn(rawIsbn?.trim() ?? '')

  if (!isbn) {
    return {
      status: 'validation-error',
      message: 'ISBN required',
    }
  }

  if (!isValidIsbn(isbn)) {
    return {
      status: 'validation-error',
      message: 'ISBN形式が不正です（10桁または13桁）',
    }
  }

  const fields = normalizeBookFields(rawFields)

  try {
    await insertBook(db, {
      user_id: userId,
      isbn,
      title: fields.title,
      author: fields.author,
      publisher: fields.publisher,
      published_at: fields.published_at,
      cover_url: fields.cover_url,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (duplicateIsbnMessages.some((pattern) => message.includes(pattern))) {
      return {
        status: 'duplicate',
        message: `この ISBN は既に登録されています: ${isbn}`,
      }
    }

    throw error
  }

  return {
    status: 'success',
    message: '手入力で登録しました',
  }
}

export const updateBookFields = async (
  db: D1Database,
  userId: number,
  bookId: number,
  rawFields: SaveBookFieldsInput,
  options: UpdateBookOptions = {}
): Promise<UpdateBookResult> => {
  const existingBook = await fetchBookByIdForUser(db, userId, bookId)
  if (!existingBook) {
    return {
      status: 'not-found',
      message: '対象の本が見つかりませんでした。',
    }
  }

  const fields = normalizeBookFields(rawFields)

  if (isManagedCoverUrlForBook(existingBook.cover_url, options.managedCoverBaseUrl, userId, bookId)) {
    fields.cover_url = existingBook.cover_url ?? undefined
  }

  const updated = await updateBookByIdForUser(db, userId, bookId, fields)

  if (!updated) {
    return {
      status: 'not-found',
      message: '対象の本が見つかりませんでした。',
    }
  }

  return {
    status: 'success',
    message: '更新しました',
  }
}

export const deleteBook = async (db: D1Database, userId: number, bookId: number): Promise<DeleteBookResult> => {
  const book = await fetchBookByIdForUser(db, userId, bookId)
  if (!book) {
    return {
      status: 'not-found',
      message: '対象の本が見つかりませんでした。',
    }
  }

  const deleted = await deleteBookByIdForUser(db, userId, bookId)

  if (!deleted) {
    return {
      status: 'not-found',
      message: '対象の本が見つかりませんでした。',
    }
  }

  return {
    status: 'success',
    message: '削除しました',
  }
}

export const deleteBookWithManagedCoverCleanup = async (
  db: D1Database,
  bucket: R2Bucket | undefined,
  publicBaseUrl: string | undefined,
  userId: number,
  bookId: number
): Promise<DeleteBookResult> => {
  const book = await fetchBookByIdForUser(db, userId, bookId)
  if (!book) {
    return {
      status: 'not-found',
      message: '対象の本が見つかりませんでした。',
    }
  }

  const managedObjectKey = getManagedCoverObjectKeyForBook(book.cover_url, publicBaseUrl, userId, bookId)
  const deleted = await deleteBookByIdForUser(db, userId, bookId)

  if (!deleted) {
    return {
      status: 'not-found',
      message: '対象の本が見つかりませんでした。',
    }
  }

  if (managedObjectKey && bucket) {
    try {
      await bucket.delete(managedObjectKey)
    } catch (error) {
      console.error('[books-service] cleanup failed for deleted book cover', {
        objectKey: managedObjectKey,
        error: error instanceof Error ? error.message : String(error),
      })
    }
  }

  return {
    status: 'success',
    message: '削除しました',
  }
}


