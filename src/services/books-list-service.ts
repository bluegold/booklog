import { countBooks, fetchBookByIdForUser, fetchBooksPage, type BookRow } from '../repositories/books-repository.js'
import { normalizeQuery, pickPage, pickPageSize, type ListBooksOptions } from './books-service.shared.js'

export type ListBooksResult = {
  books: BookRow[]
  query: string
  page: number
  pageSize: number
  totalCount: number
  totalPages: number
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

export const getBookForEdit = async (db: D1Database, userId: number, bookId: number): Promise<BookRow | null> => {
  return fetchBookByIdForUser(db, userId, bookId)
}
