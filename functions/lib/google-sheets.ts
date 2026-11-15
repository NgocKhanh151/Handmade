import { isSafeHttpsUrl, sanitizeText } from './security';
import { ProductStatusSchema, type Env, type InquiryInput, type PublicProduct } from './types';

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

function base64UrlEncode(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, '\n');
  const base64 = normalized
    .replace(/-----BEGIN PRIVATE KEY-----/g, '')
    .replace(/-----END PRIVATE KEY-----/g, '')
    .replace(/\s+/g, '');
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function getGoogleAccessToken(email: string, privateKeyPem: string): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claimSet = base64UrlEncode(
    JSON.stringify({
      iss: email,
      scope: GOOGLE_SHEETS_SCOPE,
      aud: GOOGLE_TOKEN_URL,
      exp: now + 3600,
      iat: now,
    })
  );

  const unsignedJwt = `${header}.${claimSet}`;
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign']
  );

  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    key,
    new TextEncoder().encode(unsignedJwt)
  );
  const jwt = `${unsignedJwt}.${base64UrlEncode(new Uint8Array(signature))}`;

  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!tokenRes.ok) {
    throw new Error(`Google OAuth failed (${tokenRes.status})`);
  }

  const tokenData = (await tokenRes.json()) as { access_token?: string };
  if (!tokenData.access_token) {
    throw new Error('Missing access_token in Google OAuth response');
  }
  return tokenData.access_token;
}

function parsePrice(raw: string | undefined): number {
  if (!raw) return 0;
  const digits = raw.replace(/[^\d]/g, '');
  const parsed = Number.parseInt(digits, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export async function fetchProductsFromSheet(env: Env): Promise<PublicProduct[]> {
  if (!env.GOOGLE_SHEETS_ID || !env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    throw new Error('GOOGLE_SHEETS_NOT_CONFIGURED');
  }

  const accessToken = await getGoogleAccessToken(
    env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );

  const range = encodeURIComponent('Products!A2:I');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    env.GOOGLE_SHEETS_ID
  )}/values/${range}`;

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    throw new Error(`Google Sheets API error (${res.status})`);
  }

  const payload = (await res.json()) as { values?: string[][] };
  const rows = payload.values ?? [];

  const products: PublicProduct[] = [];
  for (const row of rows) {
    const id = sanitizeText(row[0] ?? '');
    const name = sanitizeText(row[1] ?? '');
    if (!id || !name) continue;

    const rawStatus = (row[5] ?? 'active').trim().toLowerCase();
    const parsedStatus = ProductStatusSchema.safeParse(rawStatus);
    const status = parsedStatus.success ? parsedStatus.data : 'active';
    if (status === 'hidden') continue;

    const category = sanitizeText(row[2] ?? 'Thủ công') || 'Thủ công';
    const price = parsePrice(row[3]);
    const salePriceRaw = parsePrice(row[4]);
    const salePrice = salePriceRaw > 0 && salePriceRaw < price ? salePriceRaw : null;

    const rawThumb = (row[6] ?? '').trim();
    const rawGallery = (row[7] ?? '')
      .split(',')
      .map((u) => u.trim())
      .filter((u) => isSafeHttpsUrl(u, env.ALLOWED_IMAGE_HOSTS));

    const thumbnail = isSafeHttpsUrl(rawThumb, env.ALLOWED_IMAGE_HOSTS)
      ? rawThumb
      : rawGallery[0] ?? '';

    const gallery = Array.from(new Set([thumbnail, ...rawGallery].filter(Boolean)));
    const description = sanitizeText(row[8] ?? '');

    products.push({
      id,
      name,
      category,
      price,
      salePrice,
      status,
      thumbnail,
      gallery,
      description,
    });
  }

  return products;
}

export async function appendInquiryToSheet(env: Env, inquiry: InquiryInput): Promise<void> {
  if (!env.GOOGLE_SHEETS_ID || !env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY) {
    return;
  }

  const accessToken = await getGoogleAccessToken(
    env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
  );

  const range = encodeURIComponent('Inquiries!A:I');
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
    env.GOOGLE_SHEETS_ID
  )}/values/${range}:append?valueInputOption=USER_ENTERED`;

  const row = [
    new Date().toISOString(),
    inquiry.customerName,
    inquiry.phoneOrZalo,
    inquiry.productId,
    inquiry.productName,
    inquiry.dimensions,
    inquiry.colorOrMaterial,
    String(inquiry.quantity),
    inquiry.notes,
  ];

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ values: [row] }),
  });

  if (!res.ok) {
    throw new Error(`Failed to append inquiry (${res.status})`);
  }
}
