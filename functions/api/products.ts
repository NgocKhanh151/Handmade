import { fetchProductsFromSheet } from '../lib/google-sheets';
import { jsonResponse } from '../lib/security';
import type { Env, PublicProduct } from '../lib/types';

const DEMO_PRODUCTS: PublicProduct[] = [
  {
    id: 'demo-gom-01',
    name: 'Bình gốm men tro thủ công (Mẫu demo)',
    category: 'Gốm sứ',
    price: 450000,
    salePrice: 390000,
    status: 'made_to_order',
    thumbnail: 'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1578749556568-bc2c40e68b61?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1610701596007-11502861dcfa?auto=format&fit=crop&w=800&q=80',
    ],
    description:
      'Bình gốm nung củi thủ công, có thể đặt kích thước và màu men theo yêu cầu riêng.',
  },
  {
    id: 'demo-da-02',
    name: 'Ví da bò khâu tay Saddle Stitch (Mẫu demo)',
    category: 'Đồ da',
    price: 680000,
    salePrice: null,
    status: 'active',
    thumbnail: 'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1627123424574-724758594e93?auto=format&fit=crop&w=800&q=80',
    ],
    description:
      'Da bò thật 100%, khâu tay hoàn toàn bằng chỉ sáp. Nhận khắc tên miễn phí theo yêu cầu.',
  },
  {
    id: 'demo-go-03',
    name: 'Khay trà gỗ óc chó nguyên khối (Mẫu demo)',
    category: 'Đồ gỗ',
    price: 920000,
    salePrice: 820000,
    status: 'active',
    thumbnail: 'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80',
    gallery: [
      'https://images.unsplash.com/photo-1544816155-12df9643f363?auto=format&fit=crop&w=800&q=80',
    ],
    description:
      'Gỗ óc chó tự nhiên phủ dầu bảo vệ an toàn thực phẩm. Nhận gia công theo kích thước bàn trà.',
  },
];

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const { request, env, waitUntil } = context;
  const cache = caches.default;
  const cacheKey = new Request(new URL('/api/products', request.url).toString(), {
    method: 'GET',
  });

  const cached = await cache.match(cacheKey);
  if (cached) {
    return cached;
  }

  let products: PublicProduct[] = [];
  let isDemo = false;

  try {
    products = await fetchProductsFromSheet(env);
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message === 'GOOGLE_SHEETS_NOT_CONFIGURED') {
      products = DEMO_PRODUCTS;
      isDemo = true;
    } else {
      console.error('Products API error:', message);
      return jsonResponse({ error: 'Không thể tải danh sách sản phẩm lúc này.' }, 502);
    }
  }

  const categories = Array.from(new Set(products.map((p) => p.category)));
  const response = jsonResponse(
    {
      products,
      categories,
      isDemo,
      config: {
        shopName: env.SHOP_NAME ?? 'Xưởng Thủ Công',
        zaloPhone: env.ZALO_PHONE ?? '',
        messengerPageId: env.MESSENGER_PAGE_ID ?? '',
        turnstileSiteKey: env.TURNSTILE_SITE_KEY ?? '',
      },
      updatedAt: new Date().toISOString(),
    },
    200,
    {
      'Cache-Control': isDemo ? 'no-store' : 'public, max-age=300, s-maxage=300',
    }
  );

  if (!isDemo) {
    waitUntil(cache.put(cacheKey, response.clone()));
  }

  return response;
};
