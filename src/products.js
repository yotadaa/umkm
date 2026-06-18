export const defaultBusinessProfile = {
  name: 'GlowCare Clinic',
  role: 'customer service klinik kecantikan',
  address: 'Jl. Gatot Subroto No. 12, Jambi',
  hours: 'Senin-Sabtu, 09.00-20.00 WIB',
  adminPhone: '0812-0000-1111',
  currentPromo: 'Promo Facial Acne diskon 20% minggu ini. Harga normal Rp150.000 jadi Rp120.000.'
};

export const defaultProducts = [
  {
    id: 'facial-acne',
    name: 'Facial Acne',
    price: 150000,
    keywords: ['facial acne', 'acne', 'jerawat', 'facial jerawat'],
    description: 'Perawatan untuk kulit berjerawat, komedo, dan minyak berlebih.',
    promo: 'Diskon 20% minggu ini menjadi Rp120.000.'
  },
  {
    id: 'brightening',
    name: 'Facial Brightening',
    price: 175000,
    keywords: ['brightening', 'cerah', 'mencerahkan', 'kusam'],
    description: 'Perawatan untuk membantu kulit terlihat lebih cerah dan segar.',
    promo: 'Gratis konsultasi kulit sebelum treatment.'
  },
  {
    id: 'anti-aging',
    name: 'Anti Aging Treatment',
    price: 250000,
    keywords: ['anti aging', 'aging', 'kerut', 'flek', 'penuaan'],
    description: 'Perawatan untuk membantu menyamarkan tanda penuaan dan flek ringan.',
    promo: 'Paket 3x treatment hemat Rp100.000.'
  }
];

export const businessProfile = defaultBusinessProfile;
export const products = defaultProducts;

export function formatCurrency(value) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(value);
}

export function findProduct(text, productList = defaultProducts) {
  const normalized = text.toLowerCase();

  return productList.find((product) =>
    ensureArray(product.keywords).some((keyword) => normalized.includes(String(keyword).toLowerCase()))
  );
}

export function productCatalogText(productList = defaultProducts) {
  return productList
    .map((product, index) =>
      `${index + 1}. ${product.name} - ${formatCurrency(product.price)}\n${product.description}`
    )
    .join('\n\n');
}

export function ensureArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') return value.split(',').map((item) => item.trim()).filter(Boolean);
  return [];
}

export function slugifyProductName(name) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || `product-${Date.now()}`;
}
