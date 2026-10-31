import 'reflect-metadata'
import { NestFactory } from '@nestjs/core'
import { AppModule } from '../app.module.js'
import { CmsService } from '../cms/cms.service.js'
import { StoreSettingsService } from './store-settings.service.js'
import { settingsContentMigration } from './settings-content-migration.js'

async function run(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] })
  try {
    const service = app.get(StoreSettingsService)
    const settings = await service.getSettings()
    if (!settings) {
      throw new Error('Initialize store settings before migrating content.')
    }
    const cms = app.get(CmsService)
    const contacts = await cms.getBlockAdmin('contacts', 'contacts.content')
    const visit = await cms.getBlockAdmin('home', 'home.visitStore')
    const { patch, conflicts } = settingsContentMigration(
      settings,
      contacts.published,
      visit.published
    )
    if (Object.keys(patch).length) {
      await service.updateSettings(patch, null)
    }
    console.log(
      JSON.stringify(
        {
          migrated: Object.keys(patch),
          conflicts,
          policy:
            'Existing Settings values are preserved; published Contacts takes priority over Visit the store. Drafts and history are preserved.',
        },
        null,
        2
      )
    )
  } finally {
    await app.close()
  }
}
run().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'Settings migration failed')
  process.exitCode = 1
})
