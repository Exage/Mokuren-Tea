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
  brewing: {
    temperature: string
    time: string
    amount: string
  }
  isPopular: boolean
}
