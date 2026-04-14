const normalizeCoverPublicBaseUrl = (publicBaseUrl: string): string => publicBaseUrl.replace(/\/+$/, '')

export const getManagedCoverObjectKeyForBook = (
  coverUrl: string | null,
  publicBaseUrl: string | undefined,
  userId: number,
  bookId: number
): string | null => {
  if (!coverUrl) {
    return null
  }

  const rawBaseUrl = publicBaseUrl?.trim()
  if (!rawBaseUrl) {
    return null
  }

  const normalizedBaseUrl = normalizeCoverPublicBaseUrl(rawBaseUrl)
  const bookPrefix = `${normalizedBaseUrl}/users/${userId}/books/${bookId}/`
  if (!coverUrl.startsWith(bookPrefix)) {
    return null
  }

  const objectKey = coverUrl.slice(`${normalizedBaseUrl}/`.length)
  return objectKey.length > 0 ? objectKey : null
}

export const isManagedCoverUrlForBook = (
  coverUrl: string | null,
  publicBaseUrl: string | undefined,
  userId: number,
  bookId: number
): boolean => {
  return getManagedCoverObjectKeyForBook(coverUrl, publicBaseUrl, userId, bookId) !== null
}
