import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  addBookByIsbn,
  addBookManual,
  deleteBookWithManagedCoverCleanup,
  getBookForEdit,
  listBooks,
  updateBookFields,
} from './books-service.js'
import { addBookByIsbn as addBookByIsbnImpl } from './books-write-service.js'
import { getBookForEdit as getBookForEditImpl, listBooks as listBooksImpl } from './books-list-service.js'
import { fetchBookMetadataFromOpenBd } from '../external/openbd.js'
import { createMockDb } from '../test-support/mock-db.js'

vi.mock('../external/openbd.js', () => ({
  fetchBookMetadataFromOpenBd: vi.fn(),
}))

describe('books-service', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('re-exports list and write services from books-service entrypoint', () => {
    expect(listBooks).toBe(listBooksImpl)
    expect(getBookForEdit).toBe(getBookForEditImpl)
    expect(addBookByIsbn).toBe(addBookByIsbnImpl)
  })

  it('addBookByIsbn returns validation error when ISBN is empty', async () => {
    const db = createMockDb()

    const result = await addBookByIsbn(db, 1, '   ')

    expect(result).toEqual({
      status: 'validation-error',
      message: 'ISBN required',
    })
    expect(fetchBookMetadataFromOpenBd).not.toHaveBeenCalled()
  })

  it('addBookByIsbn returns not-found when metadata lookup fails', async () => {
    vi.mocked(fetchBookMetadataFromOpenBd).mockResolvedValue(null)
    const db = createMockDb()

    const result = await addBookByIsbn(db, 1, '978-4003101018')

    expect(result).toEqual({
      status: 'not-found',
      message: 'ISBN から書誌情報を取得できませんでした。手入力で登録してください。',
      isbn: '9784003101018',
    })
  })

  it('addBookByIsbn returns duplicate when insert fails with unique constraint', async () => {
    vi.mocked(fetchBookMetadataFromOpenBd).mockResolvedValue({
      title: '重複テスト',
      author: '著者',
      publisher: '出版社',
      published_at: '2020-01',
      cover_url: 'https://example.com/cover.jpg',
    })
    const db = createMockDb({
      insertError: new Error('UNIQUE constraint failed: books.user_id, books.isbn'),
    })

    const result = await addBookByIsbn(db, 1, '9784003101018')

    expect(result).toEqual({
      status: 'duplicate',
      message: 'この ISBN は既に登録されています: 9784003101018',
    })
  })

  it('addBookByIsbn rethrows non-duplicate insert errors', async () => {
    vi.mocked(fetchBookMetadataFromOpenBd).mockResolvedValue({
      title: '登録テスト',
      author: '著者',
      publisher: '出版社',
      published_at: '2020-01',
      cover_url: '',
    })
    const db = createMockDb({
      insertError: new Error('database unavailable'),
    })

    await expect(addBookByIsbn(db, 1, '9784003101018')).rejects.toThrow('database unavailable')
  })

  it('addBookManual trims optional fields before saving', async () => {
    const db = createMockDb()

    const result = await addBookManual(db, 1, '9784003101018', {
      title: '  タイトル  ',
      author: '  ',
      publisher: ' 出版社 ',
      published_at: ' 2024-01 ',
      cover_url: ' https://example.com/a.jpg ',
    })

    expect(result).toEqual({
      status: 'success',
      message: '手入力で登録しました',
    })

    const saved = await getBookForEdit(db, 1, 1)
    expect(saved?.title).toBe('タイトル')
    expect(saved?.author).toBeNull()
    expect(saved?.publisher).toBe('出版社')
    expect(saved?.published_at).toBe('2024-01')
    expect(saved?.cover_url).toBe('https://example.com/a.jpg')
  })

  it('updateBookFields returns conflict when update keeps failing', async () => {
    const baseDb = createMockDb({
      initialBooks: [
        {
          id: 10,
          user_id: 1,
          isbn: '9784003101018',
          title: '更新前',
          author: '著者',
          publisher: '出版社',
          published_at: '2020-01',
          cover_url: null,
          created_at: '2026-04-13 09:00:00',
        },
      ],
    }) as unknown as {
      prepare: (sql: string) => {
        bind: (...params: unknown[]) => {
          run: () => Promise<{ success: boolean; meta: { changes: number } }>
          first: <T>() => Promise<T | null>
          all: <T>() => Promise<{ results: T[] }>
        }
      }
    }

    const db = {
      prepare(sql: string) {
        const stmt = baseDb.prepare(sql)
        return {
          bind(...params: unknown[]) {
            const bound = stmt.bind(...params)
            if (sql.startsWith('UPDATE books SET title = ?, author = ?, publisher = ?, published_at = ?, cover_url = ?')) {
              return {
                run: async () => ({ success: true, meta: { changes: 0 } }),
                first: bound.first,
                all: bound.all,
              }
            }

            return bound
          },
        }
      },
    } as unknown as D1Database

    const result = await updateBookFields(db, 1, 10, {
      title: '更新後',
      author: '更新後著者',
      publisher: '更新後出版社',
      published_at: '2024-01',
      cover_url: 'https://example.com/new.jpg',
    })

    expect(result).toEqual({
      status: 'conflict',
      message: '更新中に競合が発生しました。もう一度お試しください。',
    })
  })

  it('deleteBookWithManagedCoverCleanup ignores bucket delete errors and still succeeds', async () => {
    const db = createMockDb({
      initialBooks: [
        {
          id: 10,
          user_id: 1,
          isbn: '9784003101018',
          title: '削除対象',
          author: '著者',
          publisher: '出版社',
          published_at: '2020-01',
          cover_url: 'https://pub.example.r2.dev/users/1/books/10/current.jpg',
          created_at: '2026-04-13 09:00:00',
        },
      ],
    })

    const bucket = {
      delete: vi.fn().mockRejectedValue(new Error('r2 transient error')),
    } as unknown as R2Bucket
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const result = await deleteBookWithManagedCoverCleanup(db, bucket, 'https://pub.example.r2.dev', 1, 10)

    expect(result).toEqual({
      status: 'success',
      message: '削除しました',
    })
    expect(bucket.delete).toHaveBeenCalledWith('users/1/books/10/current.jpg')
    expect(spy).toHaveBeenCalled()
  })
})
