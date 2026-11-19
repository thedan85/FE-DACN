# FE Status — khảo sát hiện trạng frontend

1. [ĐÃ XÁC MINH] Frontend là Next.js App Router, dùng React 19, Ant Design 6, Zustand, Zod và native `fetch`.
2. [ĐÃ XÁC MINH] Có 16 URL App Router được build, gồm storefront, auth, admin và health route.
3. [ĐÃ XÁC MINH] API client tập trung ở `src/lib/api/client.ts`, base URL lấy từ `NEXT_PUBLIC_API_BASE_URL`.
4. [ĐÃ XÁC MINH] Catalog, cart, checkout VNPAY, order history, profile và auth đang gọi API thật qua `apiFetch`.
5. [ĐÃ XÁC MINH] Admin mới có login, guard, shell và dashboard placeholder; các module admin catalog hiện chỉ có lớp API/model.
6. [ĐÃ XÁC MINH] Access token chỉ nằm trong memory; refresh token được FE kỳ vọng nằm trong HttpOnly cookie.
7. [ĐÃ XÁC MINH] Không có `middleware.ts`; bảo vệ admin hiện là client-side guard gọi `auth/me`/refresh.
8. [ĐÃ XÁC MINH] FE có kiểm tra envelope `{code,message,data}` bằng Zod ở phần lớn API response.
9. [ĐÃ XÁC MINH] `npm.cmd run lint`, `npm.cmd run build` và `npm.cmd test -- --run` đều thành công.
10. [ĐÃ XÁC MINH] Hợp đồng auth được cung cấp chưa khớp hoàn toàn: schema login thiếu `refreshToken`, refresh/logout không gửi body token.

## 1. Phạm vi và cách đọc bằng chứng

- Thời điểm khảo sát: 2026-11-05.
- `[ĐÃ XÁC MINH]` nghĩa là đã đọc file hoặc chạy lệnh trong repo này.
- `[SUY ĐOÁN]` chỉ dùng cho ước lượng hoặc kết luận cần backend/runtime bên ngoài để xác nhận.
- Không đọc được trạng thái branch/worktree vì lệnh `git` không tồn tại trong PATH: output thật là `git : The term 'git' is not recognized...`.
- Không có backend repository trong workspace này; vì vậy trạng thái CORS và việc backend thực tế đang chạy không thể xác minh từ FE.
- `.env.local` chỉ được dùng để xác định tên biến và cấu hình dev; không ghi giá trị Google client ID vào báo cáo. Không tìm thấy `.env.example`.

## 2. Stack, scripts và cấu hình

| Hạng mục | Hiện trạng và bằng chứng |
|---|---|
| Framework | `[ĐÃ XÁC MINH]` `next` `^16.4.2`, `react` `19.2.8`, `react-dom` `19.2.8` trong [package.json](./package.json). Build thực tế in `Next.js 16.4.3`. |
| UI | `[ĐÃ XÁC MINH]` `antd` `^6.6.5`, `@ant-design/icons` `^6.3.4`, `@ant-design/nextjs-registry` `^1.3.0`. |
| State | `[ĐÃ XÁC MINH]` `zustand` `^5.0.15`; store auth ở [auth-store.ts](./src/stores/auth-store.ts). Cart dùng hook/local state ở [use-cart.ts](./src/features/cart/storefront/hooks/use-cart.ts). |
| Validation | `[ĐÃ XÁC MINH]` `zod` `^4.6.5`; schema API ở [src/lib/api/schema/](./src/lib/api/schema/). |
| HTTP/form | `[ĐÃ XÁC MINH]` Không có Axios; HTTP dùng native `fetch` trong [client.ts](./src/lib/api/client.ts). Form dùng React/Ant Design primitives. |
| Scripts | `[ĐÃ XÁC MINH]` `dev: next dev`, `build: next build`, `start: next start`, `lint: eslint`, `typecheck: tsc --noEmit --incremental false`, `test: vitest run`, `check` chạy lint + typecheck + CSS check + test. |
| Dev | `[ĐÃ XÁC MINH]` Chạy `npm run dev`; README ghi origin mặc định `http://localhost:3000`. |
| Env | `[ĐÃ XÁC MINH]` [env.ts](./src/lib/env.ts) yêu cầu `NEXT_PUBLIC_API_BASE_URL` là URL HTTP/HTTPS; `NEXT_PUBLIC_GOOGLE_CLIENT_ID` optional. `.env.local` có hai tên biến này; giá trị không được liệt kê. |
| API base dev | `[ĐÃ XÁC MINH]` `.env.local` cấu hình `NEXT_PUBLIC_API_BASE_URL` tới backend dev ở `localhost:8080/api/v1`. |
| Lock/dependency | `[ĐÃ XÁC MINH]` `node_modules` và `package-lock.json` tồn tại; không cài thêm package. |

## 3. Cấu trúc và route

### Cây thư mục tối đa 3 cấp

```text
src/
├─ app/
│  ├─ (auth)/login/
│  ├─ (auth)/register/
│  ├─ (storefront)/about/
│  ├─ (storefront)/account/
│  ├─ (storefront)/cart/
│  ├─ (storefront)/checkout/
│  ├─ (storefront)/faq/
│  ├─ (storefront)/products/
│  ├─ admin/(shell)/dashboard/
│  ├─ admin/login/
│  └─ api/health/
├─ components/
│  ├─ auth/
│  ├─ dialogs/
│  ├─ feedback/
│  ├─ layout/
│  └─ ui/
├─ features/
│  ├─ auth/
│  ├─ cart/
│  ├─ orders/
│  └─ products/
├─ hooks/
├─ lib/
│  ├─ api/
│  ├─ constants/
│  └─ utils/
├─ stores/
├─ styles/
└─ types/
```

`[ĐÃ XÁC MINH]` Cấu trúc trên lấy từ danh sách file thực tế dưới `src/`; route build lấy từ output thật của `npm.cmd run build`.

### Bảng route

| URL | File | Trạng thái |
|---|---|---|
| `/` | [src/app/(storefront)/page.tsx](./src/app/(storefront)/page.tsx) | UI TRẦN |
| `/about` | [about/page.tsx](./src/app/(storefront)/about/page.tsx) | UI TRẦN |
| `/faq` | [faq/page.tsx](./src/app/(storefront)/faq/page.tsx) | UI TRẦN |
| `/products` | [products/page.tsx](./src/app/(storefront)/products/page.tsx) | HOÀN CHỈNH |
| `/products/[slug]` | [products/[slug]/page.tsx](./src/app/(storefront)/products/[slug]/page.tsx) | HOÀN CHỈNH |
| `/cart` | [cart/page.tsx](./src/app/(storefront)/cart/page.tsx) | HOÀN CHỈNH |
| `/checkout` | [checkout/page.tsx](./src/app/(storefront)/checkout/page.tsx) | HOÀN CHỈNH |
| `/account` | [account/page.tsx](./src/app/(storefront)/account/page.tsx) | HOÀN CHỈNH |
| `/account/orders` | [orders/page.tsx](./src/app/(storefront)/account/orders/page.tsx) | HOÀN CHỈNH |
| `/account/orders/[orderId]` | [orders/[orderId]/page.tsx](./src/app/(storefront)/account/orders/[orderId]/page.tsx) | HOÀN CHỈNH |
| `/login` | [(auth)/login/page.tsx](./src/app/(auth)/login/page.tsx) | HOÀN CHỈNH |
| `/register` | [(auth)/register/page.tsx](./src/app/(auth)/register/page.tsx) | HOÀN CHỈNH |
| `/admin` | [admin/page.tsx](./src/app/admin/page.tsx) | HOÀN CHỈNH (redirect) |
| `/admin/login` | [admin/login/page.tsx](./src/app/admin/login/page.tsx) | HOÀN CHỈNH |
| `/admin/dashboard` | [dashboard/page.tsx](./src/app/admin/(shell)/dashboard/page.tsx) | UI TRẦN |
| `/api/health` | [health/route.ts](./src/app/api/health/route.ts) | HOÀN CHỈNH (health FE) |

`[ĐÃ XÁC MINH]` Các `loading.tsx`, `error.tsx`, `not-found.tsx` dưới product route là boundary, không phải URL kinh doanh riêng.

## 4. Lớp API và endpoint đang gọi

`[ĐÃ XÁC MINH]` Mọi request backend đi qua `apiFetch` trong [client.ts](./src/lib/api/client.ts). Hàm này ghép path tương đối với base URL, đặt `Accept`, tự đặt `Content-Type` JSON, `cache: "no-store"`, parse JSON và ném `ApiError` cho HTTP/network error. FE production không hard-code absolute backend URL; `localhost:8080/api/v1` xuất hiện trong `.env.local` và test fixtures.

| Method | Path tương đối (base `/api/v1`) | File / hàm gọi |
|---|---|---|
| POST | `auth/login` | [auth.api.ts](./src/features/auth/api/auth.api.ts) `login` |
| POST | `auth/google` | [auth.api.ts](./src/features/auth/api/auth.api.ts) `loginWithGoogle` |
| POST | `auth/register` | [auth.api.ts](./src/features/auth/api/auth.api.ts) `register` |
| POST | `auth/refresh` | [auth.api.ts](./src/features/auth/api/auth.api.ts) `refreshSession` |
| GET | `auth/me` | [auth.api.ts](./src/features/auth/api/auth.api.ts) `getMe` |
| PATCH | `auth/me` | [auth.api.ts](./src/features/auth/api/auth.api.ts) `updateProfile` |
| POST | `auth/change-password` | [auth.api.ts](./src/features/auth/api/auth.api.ts) `changePassword` |
| POST | `auth/logout` | [auth.api.ts](./src/features/auth/api/auth.api.ts) `logout` |
| GET | `products?page=...&size=...` và filter/sort | [products.api.ts](./src/features/products/api/products.api.ts) `listProducts`, admin `listAdminProducts` |
| GET | `products/{slug}` và review paging | [products.api.ts](./src/features/products/api/products.api.ts) `getProductDetailBySlug` |
| GET | `categories?page=...&size=...` | [products.api.ts](./src/features/products/api/products.api.ts) `getCategories` |
| GET | `cart` | [cart.api.ts](./src/features/cart/api/cart.api.ts) `getCart` |
| POST | `cart/items` | [cart.api.ts](./src/features/cart/api/cart.api.ts) `addToCart` |
| PATCH | `cart/items/{cartItemId}` | [cart.api.ts](./src/features/cart/api/cart.api.ts) `updateCartItem` |
| DELETE | `cart/items/{cartItemId}` | [cart.api.ts](./src/features/cart/api/cart.api.ts) `removeCartItem` |
| POST | `cart/checkout` | [cart.api.ts](./src/features/cart/api/cart.api.ts) `checkoutCart` |
| POST | `payments/vnpay/{orderId}` | [cart.api.ts](./src/features/cart/api/cart.api.ts) `createVnpayPaymentUrl` |
| GET | `orders?page=...&size=...` và status/q/date filter | [orders.api.ts](./src/features/orders/api/orders.api.ts) `listOrders` |
| GET | `orders/{orderId}` | [orders.api.ts](./src/features/orders/api/orders.api.ts) `getOrder` |
| POST | `products` | [admin/products.api.ts](./src/features/products/admin/api/products.api.ts) `createProduct` |
| PATCH/PUT/DELETE | `products/{productId}` | [admin/products.api.ts](./src/features/products/admin/api/products.api.ts) `patchProduct`, `putProduct`, `deleteProduct` |
| POST | `variants` | [variants.api.ts](./src/features/products/admin/api/variants.api.ts) `createVariant` |
| PATCH/DELETE | `variants/{variantId}` | [variants.api.ts](./src/features/products/admin/api/variants.api.ts) `patchVariant`, `deleteVariant` |
| GET | `attributes?page=...&size=...` | [attributes.api.ts](./src/features/products/admin/api/attributes.api.ts) `listAttributes` |
| GET | `attributes/{attributeId}/values?page=...&size=...` | [attributes.api.ts](./src/features/products/admin/api/attributes.api.ts) `listAttributeValues` |
| POST/DELETE | `product-attributes`, `product-attributes/{productValueId}` | [attributes.api.ts](./src/features/products/admin/api/attributes.api.ts) `addProductAttribute`, `removeProductAttribute` |
| POST/DELETE | `variant-attributes`, `variant-attributes/{variantValueId}` | [attributes.api.ts](./src/features/products/admin/api/attributes.api.ts) `addVariantAttribute`, `removeVariantAttribute` |
| POST | `uploads/products/{productId}/thumbnail` | [media.api.ts](./src/features/products/admin/api/media.api.ts) `uploadProductThumbnail` |
| POST | `uploads/variants/{variantId}` | [media.api.ts](./src/features/products/admin/api/media.api.ts) `uploadVariantImage` |

`[ĐÃ XÁC MINH]` Response envelope được kiểm tra bằng `createApiResponseSchema` ở [api-response.schema.ts](./src/lib/api/schema/api-response.schema.ts), và các module catalog/cart/orders parse `.data`. `apiFetch` tự đọc `message`/`detail`/`title` từ lỗi nhưng không tự kiểm tra `code`/envelope cho mọi call; từng module chịu trách nhiệm parse.

## 5. Auth, token và phân quyền

| Nội dung | Hiện trạng |
|---|---|
| Login/register | `[ĐÃ XÁC MINH]` `/login` và `/register` gọi API thật; validation UI nằm trong [login-form.tsx](./src/features/auth/storefront/components/login-form.tsx) và [register-form.tsx](./src/features/auth/storefront/components/register-form.tsx). |
| Google | `[ĐÃ XÁC MINH]` Google Identity Services được nạp ở [google-auth-option.tsx](./src/components/auth/google-auth-option.tsx), credential gửi tới `POST auth/google`. |
| Access token | `[ĐÃ XÁC MINH]` Chỉ memory module trong [session.ts](./src/features/auth/session.ts); không thấy localStorage/sessionStorage. Header Authorization được tạo bởi `getAuthHeaders`. |
| Refresh token | `[ĐÃ XÁC MINH]` Comment và `credentials: "include"` cho thấy FE kỳ vọng HttpOnly cookie; reload gọi `refreshSession`. Không có mã FE lưu refresh token. |
| 401/refresh | `[ĐÃ XÁC MINH]` Store hydrate/revalidate gọi refresh khi chưa có token hoặc token lỗi; không có interceptor tự refresh trong `apiFetch`, và không có retry tự động cho request 401 đang chạy. |
| Logout | `[ĐÃ XÁC MINH]` Site header và admin header gọi `useAuthStore.signOut`; store gọi `POST auth/logout`, sau đó clear memory token. |
| Route guard | `[ĐÃ XÁC MINH]` Không có `middleware.ts`; [admin-portal-guard.tsx](./src/components/layout/admin-portal-guard.tsx) client-side revalidate rồi redirect `/admin/login`. Storefront account/cart/checkout tự hiển thị yêu cầu đăng nhập, không phải server guard. |
| Role/permission | `[ĐÃ XÁC MINH]` Admin gate chỉ loại `customer` bằng [access.ts](./src/features/auth/model/access.ts); `permissions[]` được parse nhưng chưa thấy guard theo permission trong UI. [use-catalog-permissions.ts](./src/features/products/admin/use-catalog-permissions.ts) tồn tại cho catalog model/API surface. |

## 6. Đối chiếu tính năng

### Storefront

| Tính năng | Trạng thái | Bằng chứng |
|---|---|---|
| Trang chủ | UI TRẦN | [storefront/page.tsx](./src/app/(storefront)/page.tsx) chứa nội dung/benefit tĩnh, không gọi API. |
| Danh sách: lọc, sort, search, phân trang | HOÀN CHỈNH | [products/page.tsx](./src/app/(storefront)/products/page.tsx) gọi `listProducts`/`getCategories`; có query model, sidebar, toolbar, pagination. |
| Chi tiết: variant, giá, tồn kho | HOÀN CHỈNH | [products/[slug]/page.tsx](./src/app/(storefront)/products/[slug]/page.tsx) gọi aggregate thật; [product-detail-view.tsx](./src/features/products/storefront/components/product-detail-view.tsx) chọn variant và render purchase panel. |
| Giỏ hàng | HOÀN CHỈNH | [cart-view.tsx](./src/features/cart/storefront/components/cart-view.tsx) gọi get/update/remove cart thật. |
| Checkout | HOÀN CHỈNH | [checkout-view.tsx](./src/features/cart/storefront/components/checkout-view.tsx) validate shipping và gọi `cart/checkout`. |
| Thanh toán MoMo | CHƯA CÓ | `[ĐÃ XÁC MINH]` Không có chuỗi/API MoMo; chỉ có `payments/vnpay/{orderId}` và UI VN Pay trong [cart.api.ts](./src/features/cart/api/cart.api.ts). |
| Thanh toán VNPAY/COD hiện có | HOÀN CHỈNH | `[ĐÃ XÁC MINH]` Checkout chọn `CREDIT_CARD`/`COD`, gọi payment URL VNPAY và kiểm tra URL http/https. |
| Lịch sử/chi tiết đơn hàng | HOÀN CHỈNH | [orders.api.ts](./src/features/orders/api/orders.api.ts), [order-history-view.tsx](./src/features/orders/storefront/components/order-history-view.tsx). |
| Yêu thích | CHƯA CÓ | `[ĐÃ XÁC MINH]` Không tìm thấy route, store, API hoặc component wishlist/favorite. |
| Hồ sơ tài khoản | HOÀN CHỈNH | [account/page.tsx](./src/app/(storefront)/account/page.tsx) gọi PATCH profile và POST change-password. |
| Đánh giá | UI TRẦN | [product-reviews.tsx](./src/features/products/storefront/components/product-reviews.tsx) chỉ render reviews đã trả về trong product aggregate; không có API submit/edit review. |
| Thông báo | CHƯA CÓ | `[ĐÃ XÁC MINH]` Admin bell được comment “Presentational until notifications exist” trong [admin-header.tsx](./src/components/layout/admin-header.tsx); không có notification API. |

### Admin

| Tính năng | Trạng thái | Bằng chứng |
|---|---|---|
| Login/portal guard | HOÀN CHỈNH | [admin-login-form.tsx](./src/features/auth/admin/components/admin-login-form.tsx), [admin-portal-guard.tsx](./src/components/layout/admin-portal-guard.tsx). |
| Dashboard/thống kê | UI TRẦN | [dashboard/page.tsx](./src/app/admin/(shell)/dashboard/page.tsx) ghi rõ metrics/orders/inventory sẽ xuất hiện khi nối data. |
| Quản lý tài khoản/customer | CHƯA CÓ | Sidebar chỉ có item disabled `Customers`; không có route/API account-admin trong source. |
| Sản phẩm | CHƯA CÓ | Có API/model admin trong [features/products/admin/](./src/features/products/admin/), nhưng không có admin page/editor route. |
| Variant | CHƯA CÓ | Có `variants.api.ts`, không có màn hình route tương ứng. |
| Danh mục | CHƯA CÓ | Catalog đọc categories cho storefront; sidebar `Categories` disabled, không có CRUD category API/UI. |
| Thuộc tính | CHƯA CÓ | Có `attributes.api.ts`, không có UI route admin. |
| Media | CHƯA CÓ | Có upload thumbnail/variant API trong `media.api.ts`, không có UI quản lý media. |
| Đơn hàng | CHƯA CÓ | Sidebar `Orders` disabled; order API hiện được dùng bởi storefront history. |
| Thông báo | CHƯA CÓ | Bell chỉ là ảnh presentational. |
| Phân quyền | UI TRẦN | Sidebar có `Staff & Permissions` disabled; permission list chỉ được nhận từ `auth/me`, chưa có CRUD/guard UI theo permission xác minh được. |

### Ước lượng theo nhóm

| Nhóm | Ước lượng | Căn cứ |
|---|---:|---|
| Storefront | **65%** | `[SUY ĐOÁN]` 7/11 mục đã có flow API/UI đáng kể (catalog, detail, cart, checkout, payment VNPAY/COD, orders, account); home/about/FAQ là UI tĩnh và thiếu MoMo, favorites, review write, notifications. |
| Admin | **15%** | `[SUY ĐOÁN]` Có login/guard/shell, dashboard route và API catalog nhưng gần như toàn bộ màn hình nghiệp vụ chưa có; không tính API-only là feature hoàn chỉnh. |
| Auth | **75%** | `[SUY ĐOÁN]` Login/register/Google/logout/me/refresh/profile/password và admin role gate đã có; trừ lệch refresh-token contract, thiếu permission enforcement và không có middleware/server guard. |

## 7. Đối chiếu hợp đồng backend được cung cấp

| Hợp đồng | Kết quả |
|---|---|
| Envelope `{code,message,data}` cho success/error | `[ĐÃ XÁC MINH]` FE có schema envelope và đọc `.data` ở auth/catalog/cart/orders/admin catalog. `[ĐÃ XÁC MINH]` `apiFetch` không validate envelope chung; một số side-effect như `logout`/`changePassword` không parse payload. Cần backend contract test để xác minh mọi response thực tế, nhất là lỗi. |
| `POST /api/v1/auth/register`, body password 8–128, phone 10–15 số, 201 | `[ĐÃ XÁC MINH]` FE gọi `auth/register`; UI kiểm tra password min 8 nhưng không chặn max 128 ở client, phone regex cho phép dấu `+` ([register-form.tsx](./src/features/auth/storefront/components/register-form.tsx)). `[ĐÃ XÁC MINH]` `apiFetch` chỉ kiểm tra `response.ok`, không assert status 201. |
| `POST /api/v1/auth/login`, data có accessToken + refreshToken + expiresIn 900 + Bearer | `[ĐÃ XÁC MINH]` FE gọi đúng path tương đối và đọc `.data`, nhưng [auth.schema.ts](./src/features/auth/schema/auth.schema.ts) chỉ có `accessToken`, `expiresIn`, `tokenType`; **thiếu `refreshToken`** và không ràng buộc `expiresIn=900`, `tokenType="Bearer"`. |
| `POST /api/v1/auth/refresh` nhận `{refreshToken}`, trả cặp token xoay vòng | `[ĐÃ XÁC MINH]` FE gửi POST không body, chỉ `credentials: "include"`, và schema login cũng không có refresh token. **Lệch hợp đồng nếu backend yêu cầu body token**; việc lưu token mới chỉ có access token memory, không thể xác minh refresh-token rotation từ FE. |
| `POST /api/v1/auth/logout` nhận `{refreshToken}` | `[ĐÃ XÁC MINH]` [auth.api.ts](./src/features/auth/api/auth.api.ts) gửi POST không body, dựa vào cookie. **Lệch hợp đồng nếu backend yêu cầu JSON body**. |
| `GET /api/v1/auth/me` trả roleCode lowercase và permissions | `[ĐÃ XÁC MINH]` FE gọi Bearer và parse `permissions[]`; schema cho phép mọi string, còn access check case-insensitive. Schema yêu cầu thêm `name`, `phone`, `address`, `hasPassword`, nên backend phải trả các field này hoặc FE sẽ reject. |
| Catalog `/api/...` có thể không có `/v1` | `[ĐÃ XÁC MINH]` FE đang nối mọi path với base `.env.local` có `/api/v1`, nên thực tế gọi `/api/v1/products`, `/api/v1/categories`,... Không có backend trong workspace để xác minh `/api` hay `/api/v1` là đúng. |
| Backend port 8080 / Swagger | `[ĐÃ XÁC MINH]` Port 8080 chỉ xuất hiện trong `.env.local` và test fixtures. `[SUY ĐOÁN]` Swagger `/swagger-ui/index.html` và API runtime không được FE kiểm tra; không có backend repo/server trong workspace. |
| CORS | `[ĐÃ XÁC MINH]` Origin dev FE theo README/config là `http://localhost:3000`; `[KHÔNG XÁC MINH ĐƯỢC]` backend có allow origin này hay không vì không có backend source/runtime. |

## 8. Chất lượng, test và log đáng chú ý

### Lệnh đã chạy

| Lệnh | Kết quả thật |
|---|---|
| `npm.cmd run lint` | `[ĐÃ XÁC MINH]` exit code 0; output chỉ gồm `> fe-dacn@0.1.0 lint` và `> eslint`. |
| `npm.cmd run build` | `[ĐÃ XÁC MINH]` exit code 0; compiled successfully, TypeScript finished, generated 17 static pages/routes. |
| `npm.cmd test -- --run` | `[ĐÃ XÁC MINH]` `Test Files 10 passed (10)`, `Tests 57 passed (57)`, duration 29s. |
| `npm run check` | `[CHƯA CHẠY]` Không chạy riêng vì các thành phần lint/typecheck/test đã được chạy; CSS check chưa có output lệnh riêng. |
| E2E Playwright | `[CHƯA CHẠY]` Có [e2e/example.spec.ts](./e2e/example.spec.ts) nhưng đây là example test tới `playwright.dev`, không phải flow FE. |

### TODO/FIXME/console

`[ĐÃ XÁC MINH]` Tìm kiếm `TODO|FIXME|console.log` trong `src` không cho thấy TODO/FIXME/`console.log` đáng chú ý. Có một `console.warn` có chủ đích khi categories lỗi trong [products/page.tsx](./src/app/(storefront)/products/page.tsx). Nhiều chữ “defect”, “TODO” trong comments/schema docs là ghi chú contract/thiết kế, không phải implementation TODO; cần phân loại lại khi mở backlog.

## 9. Rủi ro và việc còn thiếu, theo ưu tiên

1. **P0 — Chốt auth contract refresh rotation.** `[ĐÃ XÁC MINH]` Login schema thiếu `refreshToken`; refresh/logout không gửi body. Nếu backend đúng theo hợp đồng đã cung cấp, login/refresh/logout sẽ lệch hoặc mất khả năng xoay vòng token.
2. **P0 — Xác minh CORS và prefix catalog với backend.** `[KHÔNG XÁC MINH ĐƯỢC]` FE dev origin là `http://localhost:3000`, base là `/api/v1`, nhưng không có backend source/runtime để chứng minh allowlist và prefix.
3. **P1 — Bổ sung xử lý 401 trung tâm và timeout.** `[ĐÃ XÁC MINH]` `apiFetch` không có timeout/interceptor/retry; auth store chỉ revalidate ở hydrate/guard. Request cart/order đang chạy có thể nhận 401 mà không tự refresh.
4. **P1 — Hoàn thiện admin portal.** `[ĐÃ XÁC MINH]` Chỉ dashboard placeholder và sidebar disabled; product/variant/attribute/media API chưa được nối vào route/editor.
5. **P1 — Làm rõ payment requirement.** `[ĐÃ XÁC MINH]` FE có VNPAY, không có MoMo. Cần quyết định MoMo là yêu cầu bắt buộc hay tài liệu đã đổi sang VNPAY.
6. **P1 — Đồng bộ validation với backend.** `[ĐÃ XÁC MINH]` Register client không chặn password >128 và cho phone có `+`; login token schema không ràng buộc expires/token type; status 201 không được assert.
7. **P2 — Bổ sung favorites, review write, notifications.** `[ĐÃ XÁC MINH]` Chưa có API/UI tương ứng; reviews hiện chỉ read-only trong aggregate.
8. **P2 — Permission-based UI.** `[ĐÃ XÁC MINH]` Có `permissions[]` và model permission nhưng admin guard chỉ loại customer, chưa chứng minh disable/hide/action guard theo permission.
9. **P2 — Tăng coverage kiểm thử flow.** `[ĐÃ XÁC MINH]` Có 10 unit/component test files, nhưng chưa có test browser storefront/admin và E2E hiện tại chỉ là example ngoài app.
10. **P2 — Tạo/cập nhật `.env.example`.** `[ĐÃ XÁC MINH]` File không tồn tại; cần tài liệu hóa tên biến an toàn mà không commit secret.

## 10. Kết luận

`[ĐÃ XÁC MINH]` FE đã có nền tảng tốt cho storefront đọc catalog, mua hàng, order history, account và authentication cơ bản; chất lượng hiện tại đạt lint/build/unit test. Khoảng trống lớn nhất là admin nghiệp vụ, các feature favorites/review-write/notification, MoMo nếu vẫn bắt buộc, và hợp đồng refresh token. Các kết luận về backend runtime, CORS, Swagger và prefix API chỉ có thể chốt sau khi đối chiếu backend repository hoặc gọi môi trường dev được cấp phép.
