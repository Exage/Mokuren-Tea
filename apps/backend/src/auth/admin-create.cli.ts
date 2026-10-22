import { NestFactory } from '@nestjs/core'
import { loadEnvFile } from 'node:process'
import { fileURLToPath } from 'node:url'
import * as readlinePromises from 'node:readline/promises'
import { stdin as input, stdout as output } from 'node:process'
import { AppModule } from '../app.module.js'
import { AdminUsersService } from './admin-users.service.js'
import { normalizeEmail } from './password.js'

// Prompts for a value with visible input.
function prompt(query: string): Promise<string> {
  const rl = readlinePromises.createInterface({ input, output })
  return rl.question(query).then((answer) => {
    rl.close()
    return answer.trim()
  })
}

// Prompts for a password without echoing it to the terminal (asterisks are
// shown instead so the password itself is never displayed or logged).
function promptPassword(query: string): Promise<string> {
  return new Promise<string>((resolve) => {
    output.write(query)

    let value = ''

    const onData = (key: string) => {
      if (key === '\u0003') {
        // Ctrl+C.
        cleanup()
        process.exit(130)
      }

      if (key === '\r' || key === '\n') {
        cleanup()
        output.write('\n')
        resolve(value)
        return
      }

      if (key === '\u007f' || key === '\b') {
        if (value.length > 0) {
          value = value.slice(0, -1)
          output.write('\b \b')
        }
        return
      }

      value += key
      output.write('*')
    }

    const cleanup = () => {
      input.removeListener('data', onData)
      input.setRawMode(false)
      input.pause()
    }

    input.setRawMode(true)
    input.resume()
    input.setEncoding('utf8')
    input.on('data', onData)
  })
}

async function run(): Promise<void> {
  try {
    loadEnvFile(fileURLToPath(new URL('../../.env', import.meta.url)))
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }

  const uri = process.env.MONGODB_URI
  if (typeof uri !== 'string' || uri.length === 0) {
    console.error('MONGODB_URI is required')
    process.exitCode = 1
    return
  }

  const app = await NestFactory.create(AppModule, { logger: false })

  try {
    const service = app.get(AdminUsersService)

    const email = await prompt('Email: ')
    let normalizedEmail: string
    try {
      normalizedEmail = normalizeEmail(email)
    } catch {
      console.error('Invalid email address')
      process.exitCode = 1
      return
    }

    const displayName = await prompt('Display name: ')
    if (displayName.length === 0) {
      console.error('Display name is required')
      process.exitCode = 1
      return
    }

    const password = await promptPassword('Password: ')
    if (password.length === 0) {
      console.error('Password is required')
      process.exitCode = 1
      return
    }

    try {
      const result = await service.createUser(normalizedEmail, displayName, null, password)

      console.log()
      console.log('Administrator created.')
      console.log(`  ID:       ${result.user.id}`)
      console.log(`  Email:    ${result.user.email}`)
      console.log(`  Name:     ${result.user.displayName}`)
      console.log('The administrator can sign in with the password provided during creation.')
    } catch (error) {
      if ((error as { response?: { code?: string } })?.response?.code === 'CONFLICT') {
        console.log('Administrator already exists with this email; nothing changed.')
        return
      }
      throw error
    }
  } finally {
    await app.close()
  }
}

run().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
