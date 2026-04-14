import { fetchBookByIdForUser, updateBookCoverUrlByIdForUser } from '../repositories/books-repository.js'
import { getManagedCoverObjectKeyForBook } from './cover-url-utils.js'

const MAX_COVER_IMAGE_BYTES = 2 * 1024 * 1024
const coverMimeToExt: Record<string, 'jpg' | 'png' | 'webp'> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

export type UploadBookCoverResult =
  | { status: 'validation-error'; message: string }
  | { status: 'not-found'; message: string }
  | { status: 'success'; message: string }

export const uploadBookCover = async (
  db: D1Database,
  bucket: R2Bucket | undefined,
  publicBaseUrl: string | undefined,
  userId: number,
  bookId: number,
  file: File | null
): Promise<UploadBookCoverResult> => {
  if (!bucket) {
    return {
      status: 'validation-error',
      message: '書影保存先の設定が不足しています。',
    }
  }

  if (!publicBaseUrl?.trim()) {
    return {
      status: 'validation-error',
      message: '書影公開URLの設定が不足しています。',
    }
  }

  if (!file) {
    return {
      status: 'validation-error',
      message: 'アップロードする画像ファイルを選択してください。',
    }
  }

  const extension = coverMimeToExt[file.type]
  if (!extension) {
    return {
      status: 'validation-error',
      message: 'JPEG / PNG / WebP の画像のみアップロードできます。',
    }
  }

  if (file.size <= 0) {
    return {
      status: 'validation-error',
      message: '空のファイルはアップロードできません。',
    }
  }

  if (file.size > MAX_COVER_IMAGE_BYTES) {
    return {
      status: 'validation-error',
      message: '画像サイズは2MB以下にしてください。',
    }
  }

  const book = await fetchBookByIdForUser(db, userId, bookId)
  if (!book) {
    return {
      status: 'not-found',
      message: '対象の本が見つかりませんでした。',
    }
  }

  const normalizedBaseUrl = publicBaseUrl.replace(/\/+$/, '')
  const previousManagedObjectKey = getManagedCoverObjectKeyForBook(book.cover_url, publicBaseUrl, userId, bookId)

  const objectKey = `users/${userId}/books/${bookId}/${Date.now()}-${crypto.randomUUID()}.${extension}`
  await bucket.put(objectKey, await file.arrayBuffer(), {
    httpMetadata: {
      contentType: file.type,
    },
  })

  const cleanupUploadedObject = async (): Promise<void> => {
    try {
      await bucket.delete(objectKey)
    } catch (cleanupError) {
      console.error('[cover-service] cleanup failed after upload', {
        objectKey,
        error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      })
    }
  }

  const coverUrl = `${normalizedBaseUrl}/${objectKey}`

  let updated: boolean
  try {
    updated = await updateBookCoverUrlByIdForUser(db, userId, bookId, coverUrl)
  } catch (error) {
    await cleanupUploadedObject()
    throw error
  }

  if (!updated) {
    await cleanupUploadedObject()
    return {
      status: 'not-found',
      message: '対象の本が見つかりませんでした。',
    }
  }

  if (previousManagedObjectKey && previousManagedObjectKey !== objectKey) {
    try {
      await bucket.delete(previousManagedObjectKey)
    } catch (cleanupError) {
      console.error('[cover-service] cleanup failed for previous cover', {
        objectKey: previousManagedObjectKey,
        error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      })
    }
  }

  return {
    status: 'success',
    message: '書影画像を更新しました',
  }
}
