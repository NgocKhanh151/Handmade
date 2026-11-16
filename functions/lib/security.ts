import type { Env, InquiryInput } from './types';

export function sanitizeText(value: string): string {
  return value
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/[<>]/g, '')
    .trim();
}

export function isSafeHttpsUrl(rawUrl: string, allowedHostsCsv?: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== 'https:') return false;

    const hosts = (allowedHostsCsv ?? '')
      .split(',')
      .map((h) => h.trim().toLowerCase())
      .filter(Boolean);

    if (hosts.length > 0) {
      const hostname = parsed.hostname.toLowerCase();
      return hosts.some((allowed) => hostname === allowed || hostname.endsWith(`.${allowed}`));
    }
    return true;
  } catch {
    return false;
  }
}

export async function verifyTurnstile(
  token: string,
  remoteIp: string | null,
  secretKey: string
): Promise<boolean> {
  if (!token) return false;

  const formData = new FormData();
  formData.append('secret', secretKey);
  formData.append('response', token);
  if (remoteIp) {
    formData.append('remoteip', remoteIp);
  }

  const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) return false;
  const data = (await res.json()) as { success?: boolean };
  return Boolean(data.success);
}

export function formatInquirySummary(inquiry: InquiryInput, shopName: string): string {
  const lines = [
    `[${shopName}] YÊU CẦU TƯ VẤN / ĐẶT LÀM THỦ CÔNG`,
    `• Sản phẩm: ${inquiry.productName} (Mã: ${inquiry.productId})`,
    `• Số lượng: ${inquiry.quantity}`,
  ];

  if (inquiry.dimensions) lines.push(`• Kích thước: ${inquiry.dimensions}`);
  if (inquiry.colorOrMaterial) lines.push(`• Màu sắc / Chất liệu: ${inquiry.colorOrMaterial}`);
  if (inquiry.notes) lines.push(`• Ghi chú: ${inquiry.notes}`);
  lines.push(`• Khách hàng: ${inquiry.customerName} (${inquiry.phoneOrZalo})`);

  return lines.join('\n');
}

export async function sendTelegramNotification(env: Env, text: string): Promise<void> {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) return;

  const chatIds = env.TELEGRAM_CHAT_ID.split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  if (chatIds.length === 0) return;

  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN.trim()}/sendMessage`;
  await Promise.allSettled(
    chatIds.map((chatId) =>
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text,
        }),
      })
    )
  );
}

export function jsonResponse(data: unknown, status = 200, extraHeaders?: HeadersInit): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      ...extraHeaders,
    },
  });
}
