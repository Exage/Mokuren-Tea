import type { CmsBlockKey } from '@/app/shared/api/types/cms'

export const contentBlocks: {
  key: CmsBlockKey
  page: string
  title: string
  description: string
}[] = [
  {
    key: 'home.hero',
    page: 'Home',
    title: 'Hero',
    description: 'The first impression of your store.',
  },
  {
    key: 'home.featuredTeas',
    page: 'Home',
    title: 'Featured teas',
    description: 'A curated selection of up to four published teas.',
  },
  {
    key: 'home.testimonials',
    page: 'Home',
    title: 'Testimonials',
    description: 'Stories and kind words from your customers.',
  },
  {
    key: 'home.visitStore',
    page: 'Home',
    title: 'Visit the store',
    description: 'Invite visitors to your physical store.',
  },
  {
    key: 'catalog.header',
    page: 'Catalog',
    title: 'Catalog header',
    description: 'Introduce your tea collection.',
  },
  {
    key: 'about.content',
    page: 'About',
    title: 'Our story',
    description: 'Share the story behind Mokuren Tea.',
  },
  {
    key: 'contacts.content',
    page: 'Contacts',
    title: 'Contacts heading',
    description: 'Help customers find and contact you.',
  },
]

export interface ContentField {
  key:
    | 'eyebrow'
    | 'title'
    | 'subtitle'
    | 'body'
    | 'buttonText'
    | 'buttonUrl'
    | 'secondaryButtonText'
    | 'secondaryButtonUrl'

  label: string
  maxLength: number
  required?: boolean
  multiline?: boolean
  type?: 'email'
}
export function fieldsForBlock(key: CmsBlockKey): ContentField[] {
  const optionalTitle = ['home.featuredTeas', 'home.testimonials'].includes(key)
  const fields: ContentField[] = []
  if (key.startsWith('home.')) {
    fields.push({ key: 'eyebrow', label: 'Eyebrow', maxLength: 100 })
  }
  fields.push({ key: 'title', label: 'Title', maxLength: 200, required: !optionalTitle })
  if (['home.hero', 'home.featuredTeas', 'home.visitStore', 'catalog.header'].includes(key)) {
    fields.push({ key: 'subtitle', label: 'Subtitle', maxLength: 500, multiline: true })
  }
  if (key === 'about.content') {
    fields.push({ key: 'body', label: 'Story', maxLength: 10000, required: true, multiline: true })
  }
  if (key === 'home.hero') {
    fields.push(
      { key: 'buttonText', label: 'Primary button text', maxLength: 100 },
      { key: 'buttonUrl', label: 'Primary button link', maxLength: 500 },
      { key: 'secondaryButtonText', label: 'Secondary button text', maxLength: 100 },
      { key: 'secondaryButtonUrl', label: 'Secondary button link', maxLength: 500 }
    )
  }
  return fields
}
export function hasImage(key: CmsBlockKey) {
  return ['home.hero', 'home.visitStore', 'catalog.header', 'about.content'].includes(key)
}
