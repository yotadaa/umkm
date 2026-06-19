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
    promo: 'Diskon 20% minggu ini menjadi Rp120.000.',
    media: [
      {
        id: 'facial-acne-treatment',
        label: 'Treatment facial acne',
        type: 'image/jpeg',
        url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=80'
      },
      {
        id: 'facial-acne-room',
        label: 'Ruang konsultasi kulit',
        type: 'image/jpeg',
        url: 'https://images.unsplash.com/photo-1515377905703-c4788e51af15?auto=format&fit=crop&w=1200&q=80'
      },
      {
        id: 'facial-acne-aftercare',
        label: 'Produk after care',
        type: 'image/jpeg',
        url: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=1200&q=80'
      }
    ]
  },
  {
    id: 'brightening',
    name: 'Facial Brightening',
    price: 175000,
    keywords: ['brightening', 'cerah', 'mencerahkan', 'kusam'],
    description: 'Perawatan untuk membantu kulit terlihat lebih cerah dan segar.',
    promo: 'Gratis konsultasi kulit sebelum treatment.',
    media: [
      {
        id: 'brightening-serum',
        label: 'Serum brightening',
        type: 'image/jpeg',
        url: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?auto=format&fit=crop&w=1200&q=80'
      },
      {
        id: 'brightening-treatment',
        label: 'Perawatan wajah cerah',
        type: 'image/jpeg',
        url: 'https://images.unsplash.com/photo-1522338242992-e1a54906a8da?auto=format&fit=crop&w=1200&q=80'
      },
      {
        id: 'brightening-kit',
        label: 'Glow care kit',
        type: 'image/jpeg',
        url: 'https://images.unsplash.com/photo-1612817288484-6f916006741a?auto=format&fit=crop&w=1200&q=80'
      }
    ]
  },
  {
    id: 'anti-aging',
    name: 'Anti Aging Treatment',
    price: 250000,
    keywords: ['anti aging', 'aging', 'kerut', 'flek', 'penuaan'],
    description: 'Perawatan untuk membantu menyamarkan tanda penuaan dan flek ringan.',
    promo: 'Paket 3x treatment hemat Rp100.000.',
    media: [
      {
        id: 'anti-aging-serum',
        label: 'Serum anti aging',
        type: 'image/jpeg',
        url: 'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=1200&q=80'
      },
      {
        id: 'anti-aging-skincare',
        label: 'Paket skincare',
        type: 'image/jpeg',
        url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?auto=format&fit=crop&w=1200&q=80'
      },
      {
        id: 'anti-aging-cream',
        label: 'Cream perawatan malam',
        type: 'image/jpeg',
        url: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?auto=format&fit=crop&w=1200&q=80'
      }
    ]
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
  const numberedMatch = normalized.match(/(?:nomor|no\.?|produk|treatment|pilihan|#)\s*(\d{1,2})\b/);
  if (numberedMatch) {
    const product = productList[Number(numberedMatch[1]) - 1];
    if (product) return product;
  }

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
