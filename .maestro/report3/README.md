# Chụp màn hình còn thiếu cho Report 3 (SRS mục 3)

Agent chạy file này dùng **Maestro MCP** cho app mobile và **Playwright MCP** cho web admin. Chỉ chụp ảnh. Người kiểm tra ảnh là agent khác.

## Ràng buộc

- Không sửa code, không commit, không push.
- Không ghi CCCD hay mật khẩu vào file, log hay chat. Truyền qua env: `TAXPAYER_ID`, `TAXPAYER_PW`, `EXPERT_ID`, `EXPERT_PW`.
  - Tài khoản người nộp thuế lấy trong `../flows/settlement_result_detail.yaml`.
  - Tài khoản chuyên gia và admin lấy trong seed của BE (`Mobile/BE`).
- Chỉ chạy trên môi trường dev local. Dữ liệu tạo thêm (booking, thanh toán sandbox, đánh giá, khiếu nại, upload) ghi lại trong báo cáo.
- PNG chỉ chụp bằng `takeScreenshot` của Maestro hoặc screenshot của Playwright.
  - Không dùng `adb exec-out screencap -p > file.png` trong PowerShell: lệnh này làm hỏng file, như 4 ảnh trong `screenshots/withholding-voucher/`.
- Không chụp các màn đang báo lỗi, đang rỗng, còn "Refreshing…" hoặc spinner. Chuẩn bị dữ liệu rồi chụp lại.
- Nếu Expo Go có tuỳ chọn ẩn nút nổi **Tools** (bánh răng) thì tắt trước khi chụp.

## Chuẩn bị

1. BE chạy, có seed dữ liệu. AI Service chạy nếu cần 3-13 và OCR.
2. Emulator Android mở Expo Go. Metro chạy ở `Mobile/FE` (`npx expo start`), app mở được qua `exp://10.0.2.2:8081`.
3. Web: `npm run dev` trong `FE_web` (Vite, mặc định `http://localhost:5173`).
4. Ảnh ra thư mục `Mobile/FE/.maestro/screenshots/report3/` (web vào `report3/web/`). Chạy Maestro với thư mục làm việc là `Mobile/FE/.maestro`.

## A. Mobile — flow có sẵn

Chạy từng file trong `report3/` (không chạy `_login.yaml` riêng). Truyền env qua Maestro MCP hoặc CLI:

```
maestro test -e TAXPAYER_ID=... -e TAXPAYER_PW=... report3/r3_a_documents.yaml
```

| Flow | Ảnh tạo ra | Hình | Dữ liệu cần trước |
|---|---|---|---|
| `r3_a_documents.yaml` | `3-08b-withholding-voucher`, `3-10a-expense-list`, `3-10b-expense-upload`, `3-11-invoice-review` | 3-8, 3-10, 3-11 | ≥1 hóa đơn trong năm đang chọn, ≥1 hóa đơn "Chờ soát xét". Thiếu thì upload một ảnh hóa đơn mẫu qua màn Upload (đẩy ảnh vào thư viện emulator bằng `adb push` rồi quét media) |
| `r3_b_chat.yaml` | `3-13a-tax-chat`, `3-13b-chat-history` | 3-13 | AI Service trả lời được |
| `r3_c_experts_wallet.yaml` | `3-15-expert-list`, `3-16-expert-profile`, `3-17-expert-application`, `3-25-wallet` | 3-15, 3-16, 3-17, 3-25 | ≥1 chuyên gia đã duyệt; ví có ít nhất một giao dịch thì tốt hơn |
| `r3_d_book_pay.yaml` | `3-19a-book-consultation-empty` | 3-19 (một phần) | Chuyên gia có slot trống |
| `r3_e_my_bookings.yaml` | `3-20a-my-bookings` | 3-20 (một phần) | ≥1 lịch hẹn |
| `r3_f_expert.yaml` | `3-18-expert-slots`, `3-21-manage-consultations` | 3-18, 3-21 | Tài khoản chuyên gia có slot và có ca tư vấn |

Flow hỏng vì chữ, vị trí hay dữ liệu khác thì xem hierarchy bằng Maestro MCP rồi làm tiếp bằng tay. Báo lại bước đã đổi.

## B. Mobile — chụp tay qua Maestro MCP

Nên dùng **một lịch hẹn** đi hết vòng đời. Có sẵn lịch hẹn đúng trạng thái trong DB thì dùng luôn.

1. **3-19** (tiếp sau `r3_d`): trên form "Xác nhận đặt lịch tư vấn" chọn:
   - hình thức;
   - ngày và khung giờ;
   - lĩnh vực;
   - tiêu đề và nội dung câu hỏi.

   Chụp `3-19a-book-consultation` khi đã điền xong. Bấm "Xác nhận đặt lịch tư vấn" rồi thanh toán bằng ví hoặc VNPay **sandbox** (thẻ test công khai của VNPay). Chụp `3-19b-payment-result` ở màn "Kết quả thanh toán".
2. **3-20**: từ "Lịch hẹn của tôi", mở lịch vừa đặt, chụp `3-20b-booking-detail` ở màn "Chi tiết lịch hẹn".
3. **3-22**: lịch phải ở trạng thái CONFIRMED và đã tới giờ hẹn. Làm theo thứ tự:
   - Chuyên gia tạo slot bắt đầu sau vài phút trong "Lịch làm việc tư vấn".
   - Người nộp thuế đặt lịch và thanh toán.
   - Chuyên gia duyệt.

   Tới giờ thì mở "Chi tiết lịch hẹn" bằng tài khoản người nộp thuế, thấy nút **"Vào phòng tư vấn trực tuyến"** thì chụp `3-22-booking-meeting-room`.
4. **3-23**: lịch ở trạng thái COMPLETED, xem bằng tài khoản người nộp thuế. Phải thấy nút **"Đánh giá buổi tư vấn"** và **"Khiếu nại"**. Chụp `3-23-booking-review-dispute` (cuộn để hai nút nằm trong khung). Sau đó gửi một đánh giá và một khiếu nại (lý do ≥ 10 ký tự) để có dữ liệu cho 3-24.
5. **3-24**: đăng nhập chuyên gia, vào "Quản lý ca tư vấn" và mở đúng lịch đó. Phải thấy:
   - khối "Đánh giá & Nhận xét" có ô phản hồi đánh giá;
   - khối "Khiếu nại & Tranh chấp" có nút/khung **"Giải trình khiếu nại"** (dispute PENDING_EXPERT_RESPONSE).

   Chụp `3-24a-expert-reply-review` và `3-24b-expert-dispute-response`.

Bước nào không tạo được dữ liệu thì dừng và báo lý do, không dựng dữ liệu giả trong ảnh.

## C. Web admin — Playwright MCP

Viewport 1440×900, screenshot theo viewport (không full page). Đợi hết spinner rồi mới chụp.

| Ảnh | URL / thao tác | Hình |
|---|---|---|
| `web/3-04b-web-login.png` | `/login`, chưa đăng nhập | 3-4 |
| — | Đăng nhập tài khoản admin (lấy từ seed BE, không in ra) | |
| `web/3-26-document-types.png` | `/admin/cai-dat?tab=document-types` (tab "Loại chứng từ thuế") | 3-26 |
| `web/3-27a-system-config.png` | `/admin/cai-dat?tab=system` (tab "Tham số vận hành") | 3-27 |
| `web/3-27b-pit-parameters.png` | `/admin/tham-so-thue` ("Tham số thuế TNCN") | 3-27 |
| `web/3-28a-upload-tax-document.png` | `/admin/boc-tach-van-ban-ai` ("Tải lên văn bản thuế") | 3-28 |
| `web/3-28b-tax-rule-review.png` | `/admin/quy-tac-thue` ("Quy tắc thuế"), phải có một bộ quy tắc đang hiển thị tab bậc thuế | 3-28 |

Trang 3-28b trống thì upload một văn bản luật mẫu ở trang 3-28a để AI bóc tách, sau đó mở lại. Không bấm phê duyệt.

## Báo cáo lại

Một bảng gồm: tên ảnh | chụp được hay không | tài khoản dùng (chỉ ghi vai trò) | dữ liệu đã tạo thêm | ghi chú (bước đã sửa tay, lý do thiếu).
