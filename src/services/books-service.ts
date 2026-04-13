import { fetchBooks, insertBook, type BookRow } from '../repositories/books-repository.js'
import { fetchBookMetadataFromOpenBd } from '../external/openbd.js'

type AddBookOptions = {
  debugOpenBd?: boolean
}

type AddBookResult =
  | { status: 'validation-error'; message: string; books: BookRow[] }
  | { status: 'duplicate'; message: string; books: BookRow[] }
  | { status: 'success'; message: string; books: BookRow[] }

const duplicateIsbnMessage = 'UNIQUE constraint failed: books.isbn'
const normalizeIsbn = (rawIsbn: string): string => rawIsbn.replace(/[\s-]/g, '')
const isValidIsbn = (isbn: string): boolean => /^(?:\d{13}|\d{9}[\dXx])$/.test(isbn)

export const listBooks = async (db: D1Database): Promise<BookRow[]> => {
  return fetchBooks(db)
}

export const addBookByIsbn = async (
  db: D1Database,
  rawIsbn: string | undefined,
  options: AddBookOptions = {}
): Promise<AddBookResult> => {
  const isbn = normalizeIsbn(rawIsbn?.trim() ?? '')

  if (!isbn) {
    return {
      status: 'validation-error',
      message: 'ISBN required',
      books: await fetchBooks(db),
    }
  }

  if (!isValidIsbn(isbn)) {
    return {
      status: 'validation-error',
      message: 'ISBN形式が不正です（10桁または13桁）',
      books: await fetchBooks(db),
    }
  }

  try {
    const metadata = await fetchBookMetadataFromOpenBd(isbn, options.debugOpenBd === true)
    const insertPayload = {
      isbn,
      title: metadata?.title,
      author: metadata?.author,
      publisher: metadata?.publisher,
      published_at: metadata?.published_at,
      cover_url: metadata?.cover_url,
    }

    if (options.debugOpenBd === true) {
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

    if (message.includes(duplicateIsbnMessage)) {
      return {
        status: 'duplicate',
        message: `この ISBN は既に登録されています: ${isbn}`,
        books: await fetchBooks(db),
      }
    }

    throw error
  }

  return {
    status: 'success',
    message: `登録しました`,
    books: await fetchBooks(db),
  }
}

export type { AddBookResult }
