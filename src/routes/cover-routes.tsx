import type { Hono, MiddlewareHandler } from 'hono'
import { requireAuth } from '../middleware/auth.js'
import { csrfValidation } from '../middleware/csrf.js'
import { getCsrfTokenFromRequest } from '../security/csrf.js'
import { listBooks } from '../services/books-service.js'
import { uploadBookCover } from '../services/cover-service.js'
import { ResultMessage } from '../templates/partials/result-message.js'
import type { AppEnv } from '../types.js'
import { pickListContext, renderBookListOob, renderErrorOobResponse } from './response-helpers.js'

const MAX_COVER_UPLOAD_REQUEST_BYTES = 2 * 1024 * 1024 + 128 * 1024

const enforceCoverUploadRequestSize: MiddlewareHandler<AppEnv> = async (c, next) => {
  const rejectTooLarge = () => {
    c.status(413)
    return c.html(<ResultMessage message="アップロードサイズが大きすぎます（2MB以下）。" tone="error" />)
  }

  const contentLengthHeader = c.req.header('content-length')
  const contentLength = Number(contentLengthHeader ?? '')

  if (!Number.isFinite(contentLength)) {
    // Content-Length が不正または未指定の場合は multipart 解析前に拒否する。
    return rejectTooLarge()
  }

  if (contentLength > MAX_COVER_UPLOAD_REQUEST_BYTES) {
    return rejectTooLarge()
  }

  await next()
}

export const registerCoverRoutes = (app: Hono<AppEnv>): void => {
  // 書影画像を R2 にアップロードし cover_url を更新する。
  app.post('/books/:id/cover', requireAuth, enforceCoverUploadRequestSize, csrfValidation, async (c) => {
    const csrfToken = getCsrfTokenFromRequest(c.req.raw) ?? ''
    const bookId = Number(c.req.param('id'))
    const form = c.get('parsedForm')
    const context = pickListContext({ query: form.get('q')?.toString(), page: form.get('page')?.toString() })

    if (!Number.isFinite(bookId)) {
      const listing = await listBooks(c.env.DB, c.get('authUser')!.id, context)
      return c.html(renderErrorOobResponse('対象の本が見つかりませんでした。', listing, csrfToken))
    }

    const rawFile = form.get('cover_image')
    const file = rawFile instanceof File ? rawFile : null
    const result = await uploadBookCover(
      c.env.DB,
      c.env.BOOK_COVERS,
      c.env.BOOK_COVERS_PUBLIC_BASE_URL,
      c.get('authUser')!.id,
      bookId,
      file
    )

    const listing = await listBooks(c.env.DB, c.get('authUser')!.id, context)
    if (result.status !== 'success') {
      return c.html(renderErrorOobResponse(result.message, listing, csrfToken))
    }

    return c.html(
      <>
        <ResultMessage message={result.message} tone="success" />
        {renderBookListOob(listing, csrfToken)}
      </>
    )
  })
}
