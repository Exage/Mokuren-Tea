import type { CmsBlockKey, CmsBlockContent } from './cms.types.js'

// Snapshot of the storefront copy and active static images before CMS import.
export const STOREFRONT_IMAGES = [
  {
    blockKey: 'home.hero',
    path: 'images/home/hero-lakeside.jpg',
    name: 'Storefront hero lakeside',
    alt: 'Ceramic mug of tea and an open book beside calm water at sunset',
  },
  {
    blockKey: 'home.visitStore',
    path: 'images/home/store-shelf.jpg',
    name: 'Storefront tea boutique',
    alt: 'Glass jars of loose-leaf tea arranged on wooden shelves in a tea boutique',
  },
  {
    blockKey: 'about.content',
    path: 'images/about/about.jpg',
    name: 'Storefront about interior',
    alt: 'Warm café interior with hanging green lamps and a chalkboard menu',
  },
] as const

export const STOREFRONT_FEATURED_SLUGS = [
  'japanese-sencha',
  'milk-oolong',
  'jasmine-green',
  'earl-grey',
]

export const STOREFRONT_CONTENT: Record<CmsBlockKey, CmsBlockContent> = {
  'home.hero': {
    eyebrow: 'Welcome to Mokuren Tea',
    title: 'Find your moment of calm.',
    subtitle:
      'Discover thoughtfully selected teas from around the world. From everyday favorites to remarkable new flavors.',
    buttonText: 'Explore Teas',
    buttonUrl: '/catalog',
    secondaryButtonText: 'Our Story',
    secondaryButtonUrl: '/about',
  },
  'home.testimonials': {
    eyebrow: 'Testimonials',
    title: 'What our customers say.',
    testimonials: [
      { name: 'Alena', text: 'A little ritual that makes every day feel special.' },
      { name: 'Tomas', text: 'The Milk Oolong tastes like quiet Sunday mornings.' },
      { name: 'Priya', text: 'Reserved online, picked up in minutes. Effortless.' },
      { name: 'Marta', text: 'Sencha converted me from coffee — gently.' },
    ],
  },
  'home.featuredTeas': { eyebrow: 'Handpicked favorites', title: 'A cup for every moment.' },
  'home.visitStore': {
    eyebrow: 'Visit our store',
    title: 'Reserve online. Collect in person.',
    subtitle: 'Find your favorite teas online and collect them at our store.',
  },
  'catalog.header': {
    title: 'Explore our teas.',
    subtitle:
      'From delicate green teas to rich, comforting blends. Discover a tea for every moment.',
  },
  'about.content': {
    title: 'Tea, thoughtfully chosen.',
    body: 'At Mokuren Tea, we believe a good cup of tea is an invitation to slow down. Our collection brings together familiar favorites and distinctive discoveries, chosen for the moments they create.\n\nSmall harvests, honest sourcing, and brewing guidance for beginners and enthusiasts alike. Taste patiently — find the cup that feels like yours.',
  },
  'contacts.content': {
    title: 'Come say hello.',
    // The existing map is explicitly a demo location, so it is not configured as a real store marker.
  },
}
