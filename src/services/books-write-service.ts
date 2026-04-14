import {
  deleteBookByIdForUser,
  fetchBookByIdForUser,
  insertBook,
  updateBookByIdForUser,
} from '../repositories/books-repository.js'
import { fetchBookMetadataFromOpenBd } from '../external/openbd.js'
import { getManagedCoverObjectKeyForBook, isManagedCoverUrlForBook } from './cover-url-utils.js'
import {
  type AddBookOptions,
  type AddBookResult,
  type DeleteBookResult,
  duplicateIsbnMessages,
  isValidIsbn,
  MAX_BOOK_EDIT_UPDATE_ATTEMPTS,
  normalizeBookFields,
  normalizeIsbn,
  type SaveBookFieldsInput,
  type UpdateBookOptions,
  type UpdateBookResult,
} from './books-service.shared.js'

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
  const requestedFields = normalizeBookFields(rawFields)

  for (let attempt = 0; attempt < MAX_BOOK_EDIT_UPDATE_ATTEMPTS; attempt += 1) {
    const existingBook = await fetchBookByIdForUser(db, userId, bookId)
    if (!existingBook) {
      return {
        status: 'not-found',
        message: '対象の本が見つかりませんでした。',
      }
    }

    const fields = {
      ...requestedFields,
    }

    if (isManagedCoverUrlForBook(existingBook.cover_url, options.managedCoverBaseUrl, userId, bookId)) {
      fields.cover_url = existingBook.cover_url ?? undefined
    }

    const updated = await updateBookByIdForUser(db, userId, bookId, existingBook.cover_url, fields)
    if (updated) {
      return {
        status: 'success',
        message: '更新しました',
      }
    }
  }

  return {
    status: 'conflict',
    message: '更新中に競合が発生しました。もう一度お試しください。',
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
