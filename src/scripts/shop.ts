interface PublicProduct {
  id: string;
  name: string;
  category: string;
  price: number;
  salePrice: number | null;
  status: 'active' | 'made_to_order' | 'out_of_stock';
  thumbnail: string;
  gallery: string[];
  description: string;
}

interface ProductsResponse {
  products: PublicProduct[];
  categories: string[];
  isDemo: boolean;
  config: {
    shopName: string;
    zaloPhone: string;
    messengerPageId: string;
    turnstileSiteKey: string;
  };
}

interface InquiryResponse {
  ok?: boolean;
  error?: string;
  summaryText?: string;
  zaloUrl?: string | null;
  messengerUrl?: string | null;
}

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: string | HTMLElement,
        options: {
          sitekey: string;
          callback: (token: string) => void;
          'expired-callback'?: () => void;
        }
      ) => string;
      reset: (widgetId?: string) => void;
    };
  }
}

const STATUS_LABELS: Record<PublicProduct['status'], { text: string; cls: string }> = {
  active: { text: 'Có sẵn', cls: 'bg-emerald-100 text-emerald-800' },
  made_to_order: { text: 'Đặt làm theo yêu cầu', cls: 'bg-amber-100 text-amber-800' },
  out_of_stock: { text: 'Tạm hết', cls: 'bg-stone-200 text-stone-700' },
};

function formatVnd(amount: number): string {
  if (amount <= 0) return 'Liên hệ báo giá';
  return `${amount.toLocaleString('vi-VN')} đ`;
}

let allProducts: PublicProduct[] = [];
let activeCategory = 'Tất cả';
let searchQuery = '';
let siteConfig: ProductsResponse['config'] = {
  shopName: 'Xưởng Thủ Công',
  zaloPhone: '',
  messengerPageId: '',
  turnstileSiteKey: '',
};
let turnstileToken = '';
let turnstileWidgetId: string | undefined;

const gridEl = document.getElementById('product-grid') as HTMLElement;
const categoriesEl = document.getElementById('category-filters') as HTMLElement;
const searchInput = document.getElementById('search-input') as HTMLInputElement;
const demoBanner = document.getElementById('demo-banner') as HTMLElement;
const shopNameEl = document.getElementById('shop-name') as HTMLElement;
const emptyStateEl = document.getElementById('empty-state') as HTMLElement;

const modalEl = document.getElementById('product-modal') as HTMLElement;
const closeModalBtn = document.getElementById('close-modal') as HTMLButtonElement;
const modalMainImg = document.getElementById('modal-main-img') as HTMLImageElement;
const modalThumbs = document.getElementById('modal-thumbs') as HTMLElement;
const modalCategory = document.getElementById('modal-category') as HTMLElement;
const modalTitle = document.getElementById('modal-title') as HTMLElement;
const modalPrice = document.getElementById('modal-price') as HTMLElement;
const modalDesc = document.getElementById('modal-desc') as HTMLElement;

const inquiryForm = document.getElementById('inquiry-form') as HTMLFormElement;
const formProductId = document.getElementById('form-product-id') as HTMLInputElement;
const formProductName = document.getElementById('form-product-name') as HTMLInputElement;
const formError = document.getElementById('form-error') as HTMLElement;
const formSubmitBtn = document.getElementById('form-submit') as HTMLButtonElement;
const turnstileContainer = document.getElementById('turnstile-container') as HTMLElement;

const successBox = document.getElementById('inquiry-success') as HTMLElement;
const summaryPre = document.getElementById('inquiry-summary') as HTMLElement;
const copySummaryBtn = document.getElementById('copy-summary-btn') as HTMLButtonElement;
const zaloLink = document.getElementById('zalo-link') as HTMLAnchorElement;
const messengerLink = document.getElementById('messenger-link') as HTMLAnchorElement;
const resetFormBtn = document.getElementById('reset-form-btn') as HTMLButtonElement;

function renderCategories(categories: string[]): void {
  categoriesEl.textContent = '';
  const items = ['Tất cả', ...categories];
  for (const cat of items) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = cat;
    const isSelected = cat === activeCategory;
    btn.className = isSelected
      ? 'px-4 py-2 rounded-full text-sm font-medium bg-clay-700 text-white transition'
      : 'px-4 py-2 rounded-full text-sm font-medium bg-white border border-stone-200 text-stone-700 hover:border-clay-600 transition';
    btn.addEventListener('click', () => {
      activeCategory = cat;
      renderCategories(categories);
      renderProducts();
    });
    categoriesEl.appendChild(btn);
  }
}

function createProductCard(product: PublicProduct): HTMLElement {
  const card = document.createElement('article');
  card.className =
    'bg-white rounded-2xl border border-stone-200/80 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col';

  const imgWrap = document.createElement('div');
  imgWrap.className = 'aspect-[4/3] bg-stone-100 overflow-hidden relative';

  const img = document.createElement('img');
  img.src = product.thumbnail || 'https://placehold.co/600x450/f5f5f4/78716c?text=Handmade';
  img.alt = product.name;
  img.loading = 'lazy';
  img.className = 'w-full h-full object-cover';
  imgWrap.appendChild(img);

  const badgeInfo = STATUS_LABELS[product.status];
  const badge = document.createElement('span');
  badge.textContent = badgeInfo.text;
  badge.className = `absolute top-3 left-3 text-xs font-medium px-2.5 py-1 rounded-full ${badgeInfo.cls}`;
  imgWrap.appendChild(badge);

  const body = document.createElement('div');
  body.className = 'p-4 flex-1 flex flex-col';

  const cat = document.createElement('p');
  cat.textContent = product.category;
  cat.className = 'text-xs uppercase tracking-wider text-stone-500 mb-1';

  const title = document.createElement('h3');
  title.textContent = product.name;
  title.className = 'font-semibold text-base text-ink line-clamp-2 mb-2';

  const priceRow = document.createElement('div');
  priceRow.className = 'mt-auto pt-2 flex items-baseline gap-2';

  const mainPrice = document.createElement('span');
  mainPrice.textContent = formatVnd(product.salePrice ?? product.price);
  mainPrice.className = 'font-bold text-clay-700 text-base';
  priceRow.appendChild(mainPrice);

  if (product.salePrice && product.salePrice < product.price) {
    const oldPrice = document.createElement('span');
    oldPrice.textContent = formatVnd(product.price);
    oldPrice.className = 'text-xs text-stone-400 line-through';
    priceRow.appendChild(oldPrice);
  }

  const ctaBtn = document.createElement('button');
  ctaBtn.type = 'button';
  ctaBtn.textContent = 'Xem & Đặt theo yêu cầu';
  ctaBtn.className =
    'mt-3 w-full py-2.5 px-4 rounded-xl bg-stone-900 hover:bg-clay-700 text-white text-sm font-medium transition';
  ctaBtn.addEventListener('click', () => openModal(product));

  body.append(cat, title, priceRow, ctaBtn);
  card.append(imgWrap, body);
  return card;
}

function renderProducts(): void {
  const query = searchQuery.trim().toLowerCase();
  const filtered = allProducts.filter((p) => {
    const matchCategory = activeCategory === 'Tất cả' || p.category === activeCategory;
    const matchQuery =
      !query ||
      p.name.toLowerCase().includes(query) ||
      p.description.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query);
    return matchCategory && matchQuery;
  });

  gridEl.textContent = '';
  if (filtered.length === 0) {
    emptyStateEl.classList.remove('hidden');
    return;
  }
  emptyStateEl.classList.add('hidden');
  for (const product of filtered) {
    gridEl.appendChild(createProductCard(product));
  }
}

function ensureTurnstileRendered(): void {
  if (!siteConfig.turnstileSiteKey || !window.turnstile) return;
  if (turnstileWidgetId !== undefined) {
    window.turnstile.reset(turnstileWidgetId);
    turnstileToken = '';
    return;
  }
  turnstileWidgetId = window.turnstile.render(turnstileContainer, {
    sitekey: siteConfig.turnstileSiteKey,
    callback: (token: string) => {
      turnstileToken = token;
    },
    'expired-callback': () => {
      turnstileToken = '';
    },
  });
}

function openModal(product: PublicProduct): void {
  modalCategory.textContent = product.category;
  modalTitle.textContent = product.name;
  modalPrice.textContent = formatVnd(product.salePrice ?? product.price);
  modalDesc.textContent = product.description || 'Liên hệ để được tư vấn chi tiết.';

  const images = product.gallery.length > 0 ? product.gallery : [product.thumbnail];
  modalMainImg.src = images[0] || 'https://placehold.co/600x450/f5f5f4/78716c?text=Handmade';
  modalMainImg.alt = product.name;

  modalThumbs.textContent = '';
  for (const url of images) {
    if (!url) continue;
    const thumbBtn = document.createElement('button');
    thumbBtn.type = 'button';
    thumbBtn.className = 'w-14 h-14 rounded-lg overflow-hidden border border-stone-200 hover:border-clay-600';
    const thumbImg = document.createElement('img');
    thumbImg.src = url;
    thumbImg.alt = product.name;
    thumbImg.className = 'w-full h-full object-cover';
    thumbBtn.appendChild(thumbImg);
    thumbBtn.addEventListener('click', () => {
      modalMainImg.src = url;
    });
    modalThumbs.appendChild(thumbBtn);
  }

  formProductId.value = product.id;
  formProductName.value = product.name;
  formError.classList.add('hidden');
  successBox.classList.add('hidden');
  inquiryForm.classList.remove('hidden');

  modalEl.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  ensureTurnstileRendered();
}

function closeModal(): void {
  modalEl.classList.add('hidden');
  document.body.style.overflow = '';
}

closeModalBtn.addEventListener('click', closeModal);
modalEl.addEventListener('click', (e) => {
  if (e.target === modalEl) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !modalEl.classList.contains('hidden')) closeModal();
});

searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  renderProducts();
});

inquiryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  formError.classList.add('hidden');
  formSubmitBtn.disabled = true;
  formSubmitBtn.textContent = 'Đang gửi yêu cầu...';

  const formData = new FormData(inquiryForm);
  const payload = {
    customerName: String(formData.get('customerName') ?? ''),
    phoneOrZalo: String(formData.get('phoneOrZalo') ?? ''),
    productId: String(formData.get('productId') ?? 'custom'),
    productName: String(formData.get('productName') ?? ''),
    dimensions: String(formData.get('dimensions') ?? ''),
    colorOrMaterial: String(formData.get('colorOrMaterial') ?? ''),
    quantity: Number(formData.get('quantity') ?? 1),
    notes: String(formData.get('notes') ?? ''),
    turnstileToken,
  };

  try {
    const res = await fetch('/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = (await res.json()) as InquiryResponse;
    if (!res.ok || !data.ok) {
      throw new Error(data.error || 'Không thể gửi yêu cầu.');
    }

    summaryPre.textContent = data.summaryText ?? '';
    if (data.zaloUrl) {
      zaloLink.href = data.zaloUrl;
      zaloLink.classList.remove('hidden');
    } else {
      zaloLink.classList.add('hidden');
    }

    if (data.messengerUrl) {
      messengerLink.href = data.messengerUrl;
      messengerLink.classList.remove('hidden');
    } else {
      messengerLink.classList.add('hidden');
    }

    inquiryForm.classList.add('hidden');
    successBox.classList.remove('hidden');
  } catch (err) {
    formError.textContent = err instanceof Error ? err.message : 'Có lỗi xảy ra, vui lòng thử lại.';
    formError.classList.remove('hidden');
    if (window.turnstile && turnstileWidgetId !== undefined) {
      window.turnstile.reset(turnstileWidgetId);
      turnstileToken = '';
    }
  } finally {
    formSubmitBtn.disabled = false;
    formSubmitBtn.textContent = 'Gửi yêu cầu & Mở chat Zalo / Messenger';
  }
});

copySummaryBtn.addEventListener('click', async () => {
  await navigator.clipboard.writeText(summaryPre.textContent ?? '');
  copySummaryBtn.textContent = 'Đã copy nội dung!';
  setTimeout(() => {
    copySummaryBtn.textContent = 'Copy nội dung yêu cầu';
  }, 2000);
});

resetFormBtn.addEventListener('click', () => {
  inquiryForm.reset();
  successBox.classList.add('hidden');
  inquiryForm.classList.remove('hidden');
  ensureTurnstileRendered();
});

async function init(): Promise<void> {
  try {
    const res = await fetch('/api/products');
    if (!res.ok) throw new Error('Fetch failed');
    const data = (await res.json()) as ProductsResponse;
    allProducts = data.products;
    siteConfig = data.config;
    shopNameEl.textContent = siteConfig.shopName;
    if (data.isDemo) {
      demoBanner.classList.remove('hidden');
    }
    renderCategories(data.categories);
    renderProducts();
  } catch {
    gridEl.textContent = 'Không thể tải sản phẩm. Vui lòng tải lại trang.';
  }
}

init();
