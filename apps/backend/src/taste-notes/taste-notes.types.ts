export interface LoadedTasteNote {
  _id: unknown
  name: string
  slug: string
  sortOrder: number
  referenceRevision: number
  createdAt: Date
  updatedAt: Date
}

export interface PublicTasteNoteView {
  id: string
  name: string
  slug: string
  sortOrder: number
}

export interface AdminTasteNoteView {
  id: string
  name: string
  slug: string
  sortOrder: number
  createdAt: string
  updatedAt: string
  productsCount: number
}
