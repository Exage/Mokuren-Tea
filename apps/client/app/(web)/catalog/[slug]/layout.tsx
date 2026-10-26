import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { MOCK_PRODUCTS } from '@/app/shared/mocks/products'

export function generateStaticParams() {
  return MOCK_PRODUCTS.map(({ slug }) => ({ slug }))
}

export async function generateMetadata({
  params,
}: LayoutProps<'/catalog/[slug]'>): Promise<Metadata> {
  const { slug } = await params
  const product = MOCK_PRODUCTS.find((item) => item.slug === slug)

  if (!product) {
    notFound()
  }

  return {
    title: `${product.name} — Mokuren Tea`,
    description: product.description,
  }
}

export default function ProductLayout({ children }: { children: ReactNode }) {
  return children
}
