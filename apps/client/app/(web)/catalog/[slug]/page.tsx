import { ProductScreen } from '@/app/screens/product'

export default function ProductPage({ params }: PageProps<'/catalog/[slug]'>) {
  return <ProductScreen params={params} />
}
