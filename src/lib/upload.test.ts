import test from 'node:test'
import assert from 'node:assert/strict'

import { getImageExtension, validateImageUpload } from './upload'

test('validateImageUpload accepts supported image types within size limit', () => {
  const result = validateImageUpload({
    mimeType: 'image/png',
    size: 1024,
  })

  assert.equal(result.valid, true)
})

test('validateImageUpload rejects unsupported mime types', () => {
  const result = validateImageUpload({
    mimeType: 'application/pdf',
    size: 1024,
  })

  assert.equal(result.valid, false)
  assert.equal(result.error, 'Only JPG, PNG, WEBP, and GIF images are allowed.')
})

test('getImageExtension prefers mime-based extension', () => {
  const extension = getImageExtension('photo.unknown', 'image/webp')

  assert.equal(extension, '.webp')
})

test('validateImageUpload rejects images larger than 4MB', () => {
  const result = validateImageUpload({
    mimeType: 'image/jpeg',
    size: 4 * 1024 * 1024 + 1,
  })

  assert.equal(result.valid, false)
  assert.equal(result.error, 'Image file must be 4MB or smaller.')
})

