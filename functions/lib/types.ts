import { z } from 'zod';

export interface Env {
  GOOGLE_SHEETS_ID?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
  TURNSTILE_SITE_KEY?: string;
  TURNSTILE_SECRET_KEY?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_CHAT_ID?: string;
  SHOP_NAME?: string;
  ZALO_PHONE?: string;
  MESSENGER_PAGE_ID?: string;
  ALLOWED_IMAGE_HOSTS?: string;
}

export const ProductStatusSchema = z.enum([
  'active',
  'made_to_order',
  'out_of_stock',
  'hidden',
]);

export interface PublicProduct {
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

export const InquiryInputSchema = z.object({
  customerName: z.string().trim().min(2, 'Vui lòng nhập họ tên').max(80),
  phoneOrZalo: z
    .string()
    .trim()
    .min(8, 'Số điện thoại/Zalo không hợp lệ')
    .max(25)
    .regex(/^[0-9+\-\s().]+$/, 'Số điện thoại chỉ được chứa chữ số và ký tự + - ( )'),
  productId: z.string().trim().max(80).default('custom'),
  productName: z.string().trim().min(1).max(160),
  dimensions: z.string().trim().max(120).optional().default(''),
  colorOrMaterial: z.string().trim().max(120).optional().default(''),
  quantity: z.coerce.number().int().min(1).max(999).default(1),
  notes: z.string().trim().max(1000).optional().default(''),
  turnstileToken: z.string().trim().optional().default(''),
});

export type InquiryInput = z.infer<typeof InquiryInputSchema>;
