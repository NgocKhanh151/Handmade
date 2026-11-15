# Web Trưng Bày & Đặt Hàng Thủ Công (Astro + Cloudflare Pages + Google Sheets)

Dự án web bán hàng trưng bày sản phẩm thủ công, nhập dữ liệu và link ảnh từ **Google Sheets**, chạy hoàn toàn trên gói **miễn phí của Cloudflare** (Pages, Functions/Workers, Cache API, Turnstile, R2).

## 1. Cấu trúc Google Sheets
Tạo 1 file Google Sheets (giữ chế độ **Private**, không public ra ngoài) gồm 2 tab:

### Tab `Products` (Dòng 1 là tiêu đề, dữ liệu bắt đầu từ dòng 2)
| Cột | Tên trường | Ví dụ |
|---|---|---|
| A | `id` | `gom-01` |
| B | `name` | `Bình gốm men tro thủ công` |
| C | `category` | `Gốm sứ` |
| D | `price` | `450000` |
| E | `sale_price` | `390000` (để trống nếu không giảm giá) |
| F | `status` | `active`, `made_to_order`, `out_of_stock`, hoặc `hidden` |
| G | `thumbnail` | `https://pub-xxxx.r2.dev/binh-gom-1.jpg` |
| H | `gallery` | Nhiều link cách nhau dấu phẩy `,` |
| I | `description` | Mô tả chi tiết sản phẩm |

### Tab `Inquiries` (Lưu yêu cầu khách gửi từ form)
| Cột A → I |
|---|
| `timestamp` \| `customerName` \| `phoneOrZalo` \| `productId` \| `productName` \| `dimensions` \| `colorOrMaterial` \| `quantity` \| `notes` |

## 2. Lưu trữ ảnh miễn phí trên Cloudflare R2 hoặc Cloudinary
- **Cloudflare R2:** Vào **Build → Storage & databases → R2 Object Storage** → Tạo bucket → Bật **Public Development URL** → Kéo thả ảnh lên và copy URL dán vào Google Sheets.
- **Cloudinary (nếu chưa muốn thêm thẻ vào Cloudflare):** Đăng ký gói Free → Upload ảnh → Copy link `https://res.cloudinary.com/...` dán vào Google Sheets.

## 3. Tạo Google Service Account (Bảo mật kết nối Sheet)
1. Vào [Google Cloud Console](https://console.cloud.google.com/) → Tạo Project mới → Bật **Google Sheets API**.
2. Vào **IAM & Admin → Service Accounts** → Tạo tài khoản mới → Tab **Keys → Add key → Create new key (JSON)**.
3. Mở file Google Sheets của bạn → Bấm **Share** → Chia sẻ quyền **Editor** cho địa chỉ `client_email` trong file JSON.

## 4. Triển khai lên Cloudflare Pages (Miễn phí)
1. Đẩy thư mục `handmade-shop` lên GitHub/GitLab (đã có `.gitignore` chặn `keysheet.txt` và `Google_Sheet_ServicesKey.json`).
2. Vào **Cloudflare Dashboard → Build → Compute → Workers & Pages → Create → Pages → Connect to Git**.
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
3. Vào **Settings → Environment variables** của Pages project và thêm:
   - `GOOGLE_SHEETS_ID` (ID trên URL của file Google Sheets)
   - `GOOGLE_SERVICE_ACCOUNT_EMAIL` (`client_email`)
   - `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (`private_key` — đánh dấu là Secret/Encrypt)
   - `TURNSTILE_SITE_KEY` & `TURNSTILE_SECRET_KEY` (tạo miễn phí tại mục **Turnstile** trên Cloudflare)
   - `ZALO_PHONE` (VD: `0901234567`)
   - `MESSENGER_PAGE_ID` (ID/username Fanpage Facebook của bạn)
   - *(Tùy chọn)* `TELEGRAM_BOT_TOKEN` & `TELEGRAM_CHAT_ID` để nhận tin báo ngay khi có khách gửi form.

## 5. Cài đặt & Chạy thử trên máy cá nhân
*(Yêu cầu máy đã cài Node.js 18+)*
```bash
cd handmade-shop
npm install
npm run build
npx wrangler pages dev ./dist
```
