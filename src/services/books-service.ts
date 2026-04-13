import { fetchBooks, insertBook, type BookRow } from '../repositories/books-repository.js'
import { fetchBookMetadataFromOpenBd } from '../external/openbd.js'

type AddBookOptions = {
  debug?: boolean
}

type ListBooksOptions = {
  query?: string | undefined
  page?: number | undefined
  pageSize?: number | undefined
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
  | { status: 'duplicate'; message: string }
  | { status: 'success'; message: string }

const duplicateIsbnMessages = ['UNIQUE constraint failed: books.isbn', 'UNIQUE constraint failed: books.user_id, books.isbn']
const DEFAULT_PAGE_SIZE = 10
const normalizeIsbn = (rawIsbn: string): string => rawIsbn.replace(/[\s-]/g, '')
const isValidIsbn = (isbn: string): boolean => /^(?:\d{13}|\d{9}[\dXx])$/.test(isbn)
const normalizeQuery = (rawQuery: string | undefined): string => rawQuery?.trim().toLowerCase() ?? ''

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
  const allBooks = await fetchBooks(db, userId)
  const filteredBooks =
    query.length === 0
      ? allBooks
      : allBooks.filter((book) => {
          const haystacks = [book.isbn, book.title, book.author, book.publisher]
          return haystacks.some((value) => (value ?? '').toLowerCase().includes(query))
        })

  const totalCount = filteredBooks.length
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize))
  const page = Math.min(requestedPage, totalPages)
  const start = (page - 1) * pageSize
  const books = filteredBooks.slice(start, start + pageSize)

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
