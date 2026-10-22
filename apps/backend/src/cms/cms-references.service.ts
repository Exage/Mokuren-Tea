import { Injectable } from '@nestjs/common'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import type { ClientSession } from 'mongoose'
import { CmsBlock } from './schemas/cms-block.schema.js'

@Injectable()
export class CmsReferencesService {
  constructor(@InjectModel(CmsBlock.name) private readonly blockModel: Model<CmsBlock>) {}

  async hasPublishedProduct(productId: string, session: ClientSession): Promise<boolean> {
    const reference = await this.blockModel
      .exists({
        pageKey: 'home',
        blockKey: 'home.featuredTeas',
        'published.teaIds': productId,
      })
      .session(session)
      .exec()
    return Boolean(reference)
  }
}
