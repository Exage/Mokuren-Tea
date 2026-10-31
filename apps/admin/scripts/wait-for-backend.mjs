import { setTimeout } from 'node:timers/promises'

const apiUrl = (process.env.ADMIN_API_URL || 'http://127.0.0.1:3001/api').replace(/\/$/, '')
const healthUrl = `${apiUrl}/health`
const deadline = Date.now() + 60_000

console.log(`Waiting for backend at ${healthUrl}...`)

while (true) {
  try {
    const response = await fetch(healthUrl, { signal: AbortSignal.timeout(2000) })
    if (response.ok) {
      console.log('Backend is ready. Starting admin...')
      break
    }
  } catch {
    // Connection failures are expected while the backend compiles and starts.
  }

  if (Date.now() >= deadline) {
    console.error(`Backend was not ready within 60 seconds. Check its logs: ${healthUrl}`)
    process.exit(1)
  }

  await setTimeout(500)
}
