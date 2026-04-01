const MAX_UPLOAD_SIZE = 4 * 1024 * 1024

const MIME_EXTENSION_MAP: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
}

export function getAllowedImageMimeTypes() {
  return Object.keys(MIME_EXTENSION_MAP)
}

export function validateImageUpload(input: { mimeType: string; size: number }) {
  if (!getAllowedImageMimeTypes().includes(input.mimeType)) {
    return { valid: false, error: 'Only JPG, PNG, WEBP, and GIF images are allowed.' }
  }

  if (input.size <= 0) {
    return { valid: false, error: 'Image file is empty.' }
  }

  if (input.size > MAX_UPLOAD_SIZE) {
    return { valid: false, error: 'Image file must be 4MB or smaller.' }
  }

  return { valid: true as const }
}

export function getImageExtension(fileName: string, mimeType: string) {
  const knownExtension = MIME_EXTENSION_MAP[mimeType]
  if (knownExtension) return knownExtension

  const trimmed = fileName.trim()
  const lastDot = trimmed.lastIndexOf('.')
  if (lastDot <= 0 || lastDot === trimmed.length - 1) return '.jpg'
  return trimmed.slice(lastDot).toLowerCase()
}

