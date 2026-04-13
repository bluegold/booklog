import { fetchBooks, insertBookByIsbn, type BookRow } from '../repositories/books-repository.js'

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

export const addBookByIsbn = async (db: D1Database, rawIsbn: string | undefined): Promise<AddBookResult> => {
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
    await insertBookByIsbn(db, isbn)
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
    message: `登録: ${isbn}`,
    books: await fetchBooks(db),
  }
}

export type { AddBookResult }
