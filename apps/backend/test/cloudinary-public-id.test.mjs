import assert from 'node:assert/strict'
import { test } from 'node:test'
import { v2 as cloudinary } from 'cloudinary'
import { CloudinaryService } from '../dist/media-assets/cloudinary.service.js'

function configStub(values) {
  return {
    get: (key) => values[key],
  }
}

test('generates unique public ids that never include the asset folder', () => {
  const service = new CloudinaryService(
    configStub({
      NODE_ENV: 'development',
      CLOUDINARY_CLOUD_NAME: 'demo',
      CLOUDINARY_API_KEY: 'key',
      CLOUDINARY_API_SECRET: 'secret',
      CLOUDINARY_ASSET_FOLDER: 'tea shop',
    })
  )

  const first = service.buildPublicId('64f000000000000000000001')
  const second = service.buildPublicId('64f000000000000000000002')

  assert.notEqual(first, second)
  assert.ok(first.includes('development'))
  assert.ok(!first.includes('tea shop'))
  assert.ok(!first.includes('/'))
})

test('separates production public ids from development', () => {
  const productionService = new CloudinaryService(
    configStub({
      NODE_ENV: 'production',
      CLOUDINARY_CLOUD_NAME: 'demo',
      CLOUDINARY_API_KEY: 'key',
      CLOUDINARY_API_SECRET: 'secret',
      CLOUDINARY_ASSET_FOLDER: 'tea shop',
    })
  )

  const id = productionService.buildPublicId('64f000000000000000000001')
  assert.ok(id.includes('production'))
})

test('requests proportional resizing of uploaded images to 558 pixels wide', async (t) => {
  let options
  t.mock.method(cloudinary.uploader, 'upload_stream', (uploadOptions, callback) => {
    options = uploadOptions
    return {
      end: () => callback(null, {
        secure_url: 'https://example.com/image.jpg',
        width: 558,
        height: 372,
      }),
    }
  })
  const service = new CloudinaryService(configStub({}))
  const result = await service.uploadImage(new Uint8Array([1]), 'image-id')

  assert.deepEqual(options.transformation, [{ width: 558, crop: 'scale' }])
  assert.equal(result.width, 558)
  assert.equal(result.height, 372)
})
