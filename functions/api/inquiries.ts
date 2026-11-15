import { appendInquiryToSheet } from '../lib/google-sheets';
import {
  formatInquirySummary,
  jsonResponse,
  sanitizeText,
  sendTelegramNotification,
  verifyTurnstile,
} from '../lib/security';
import { InquiryInputSchema, type Env } from '../lib/types';

export const onRequestPost: PagesFunction<Env> = async (context) => {
  const { request, env } = context;

  const contentLength = Number(request.headers.get('content-length') ?? '0');
  if (contentLength > 16_384) {
    return jsonResponse({ error: 'Dữ liệu gửi lên quá lớn.' }, 413);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return jsonResponse({ error: 'Dữ liệu JSON không hợp lệ.' }, 400);
  }

  const parsed = InquiryInputSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? 'Thông tin chưa hợp lệ.';
    return jsonResponse({ error: firstError }, 400);
  }

  const inquiry = {
    ...parsed.data,
    customerName: sanitizeText(parsed.data.customerName),
    phoneOrZalo: sanitizeText(parsed.data.phoneOrZalo),
    productId: sanitizeText(parsed.data.productId),
    productName: sanitizeText(parsed.data.productName),
    dimensions: sanitizeText(parsed.data.dimensions),
    colorOrMaterial: sanitizeText(parsed.data.colorOrMaterial),
    notes: sanitizeText(parsed.data.notes),
  };

  if (env.TURNSTILE_SECRET_KEY) {
    const remoteIp = request.headers.get('CF-Connecting-IP');
    const isHuman = await verifyTurnstile(
      inquiry.turnstileToken,
      remoteIp,
      env.TURNSTILE_SECRET_KEY
    );
    if (!isHuman) {
      return jsonResponse(
        { error: 'Xác thực chống spam (Turnstile) chưa đạt. Vui lòng thử lại.' },
        403
      );
    }
  }

  const shopName = env.SHOP_NAME ?? 'Xưởng Thủ Công';
  const summaryText = formatInquirySummary(inquiry, shopName);

  try {
    await Promise.all([
      appendInquiryToSheet(env, inquiry),
      sendTelegramNotification(env, summaryText),
    ]);
  } catch {
    return jsonResponse(
      { error: 'Hệ thống đang bận, vui lòng thử lại hoặc nhắn trực tiếp qua Zalo/Messenger.' },
      502
    );
  }

  const zaloPhone = (env.ZALO_PHONE ?? '').replace(/[^\d]/g, '');
  const messengerPageId = (env.MESSENGER_PAGE_ID ?? '').trim();

  return jsonResponse({
    ok: true,
    summaryText,
    zaloUrl: zaloPhone ? `https://zalo.me/${zaloPhone}` : null,
    messengerUrl: messengerPageId ? `https://m.me/${encodeURIComponent(messengerPageId)}` : null,
  });
};
