import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { getProduct } from '@/app/shared/api/requests/products'

export async function generateMetadata({
  params,
}: LayoutProps<'/catalog/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const product = await getProduct(slug)
  return product ? { title: `${product.name} — Mokuren Tea`, description: product.description } : {}
}

export default function ProductLayout({ children }: { children: ReactNode }) {
  return children
}
