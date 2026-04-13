import { fetchBooks, insertBookByIsbn, type BookRow } from '../repositories/books-repository.js'

type AddBookResult =
  | { status: 'validation-error'; message: string; books: BookRow[] }
  | { status: 'duplicate'; message: string; books: BookRow[] }
  | { status: 'success'; message: string; books: BookRow[] }

const duplicateIsbnMessage = 'UNIQUE constraint failed: books.isbn'

export const listBooks = async (db: D1Database): Promise<BookRow[]> => {
  return fetchBooks(db)
}

export const addBookByIsbn = async (db: D1Database, rawIsbn: string | undefined): Promise<AddBookResult> => {
  const isbn = rawIsbn?.trim() ?? ''

  if (!isbn) {
    return {
      status: 'validation-error',
      message: 'ISBN required',
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
