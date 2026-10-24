export interface Product {
  id: string
  slug: string
  name: string
  category: string
  origin: string
  description: string
  tastes: string[]
  image: string
  price: number
  weightGrams: number
  isPopular: boolean
}
