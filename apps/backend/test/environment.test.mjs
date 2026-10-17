import assert from 'node:assert/strict'
import { test } from 'node:test'
import { validateEnvironment } from '../dist/config/environment.js'

const mongoUri = 'mongodb://127.0.0.1:27017/mokuren_test'

test('uses defaults and converts the configured port to a number', () => {
  assert.deepEqual(validateEnvironment({ MONGODB_URI: mongoUri }), {
    NODE_ENV: 'development',
    PORT: 3001,
    MONGODB_URI: mongoUri,
  })
  assert.equal(validateEnvironment({ MONGODB_URI: mongoUri, PORT: '4000' }).PORT, 4000)
})

test('rejects invalid ports before starting the server', () => {
  for (const port of ['', 'abc', '1.5', '0', '-1', '65536']) {
    assert.throws(() => validateEnvironment({ MONGODB_URI: mongoUri, PORT: port }), /PORT/)
  }
})

test('requires a MongoDB URI without exposing its value in errors', () => {
  for (const uri of [undefined, '', 'https://user:secret@example.com', 'mongodb://']) {
    assert.throws(() => validateEnvironment({ MONGODB_URI: uri }), {
      message: 'MONGODB_URI must be a MongoDB connection string',
    })
  }
  const uri = 'mongodb+srv://user:password@cluster.example.com/mokuren_tea'
  assert.equal(validateEnvironment({ MONGODB_URI: uri }).MONGODB_URI, uri)
})

test('rejects unknown runtime environments', () => {
  assert.throws(
    () => validateEnvironment({ MONGODB_URI: mongoUri, NODE_ENV: 'invalid' }),
    /NODE_ENV/
  )
})

test('keeps Cloudinary optional outside production', () => {
  const config = validateEnvironment({ MONGODB_URI: mongoUri })
  assert.equal(config.CLOUDINARY_CLOUD_NAME, undefined)
  assert.equal(config.CLOUDINARY_ASSET_FOLDER, undefined)
})

test('validates Cloudinary credentials and asset folder together', () => {
  const cloud = {
    CLOUDINARY_CLOUD_NAME: 'demo',
    CLOUDINARY_API_KEY: 'key',
    CLOUDINARY_API_SECRET: 'secret',
    CLOUDINARY_ASSET_FOLDER: 'tea shop',
  }

  const config = validateEnvironment({ MONGODB_URI: mongoUri, ...cloud })
  assert.equal(config.CLOUDINARY_ASSET_FOLDER, 'tea shop')

  assert.throws(
    () => validateEnvironment({ MONGODB_URI: mongoUri, NODE_ENV: 'production', ...cloud, CLOUDINARY_ASSET_FOLDER: '' }),
    /CLOUDINARY_ASSET_FOLDER/
  )
  assert.throws(
    () => validateEnvironment({ MONGODB_URI: mongoUri, ...cloud, CLOUDINARY_ASSET_FOLDER: undefined }),
    /CLOUDINARY_ASSET_FOLDER/
  )
  assert.throws(
    () =>
      validateEnvironment({
        MONGODB_URI: mongoUri,
        NODE_ENV: 'production',
        CLOUDINARY_CLOUD_NAME: 'demo',
        CLOUDINARY_API_KEY: 'key',
        CLOUDINARY_API_SECRET: 'secret',
      }),
    /CLOUDINARY_ASSET_FOLDER/
  )
})
