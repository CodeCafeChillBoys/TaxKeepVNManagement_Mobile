# Báo cáo Maestro — Chi tiết kết quả quyết toán

**Ngày:** 2026-10-08  
**Tài khoản:** `038195123456` / Lê Văn Đức  
**Môi trường:** Expo Go + emulator-5554 · API `localhost:5023` · Metro `:8081`  
**Ràng buộc:** không sửa code app; chỉ seed dữ liệu qua API khi thiếu

## Dữ liệu đã bổ sung (API)

| Mục | Hành động | Kết quả |
|-----|-----------|---------|
| Nơi chi trả thứ 2 | Tạo MST `0101248141` — Cong ty Co phan Dich vu So ABC · gross 120.000.000 · withheld 8.000.000 | Preview thấy **2** nơi chi trả |
| Preview charity 0 / 1M | `POST /api/v1/tax-settlements/preview` | Lưu `_preview-charity0.json`, `_preview-charity1m.json` |

## Số liệu chính (API ↔ UI)

### Kịch bản 1 — Xem trước 2026, từ thiện = 0

| Chỉ tiêu | Giá trị | Ảnh |
|----------|---------|-----|
| Nơi chi trả | 2 (Viettel 450M + ABC 120M) | `02-income.png`, `03-income-company-expanded.png` |
| Tổng TN chịu thuế | 570.000.000 | `02-income.png` |
| BH bắt buộc đã trích | 0 | `02-income.png`, `05-deductions.png` |
| Thuế đã khấu trừ | 33.000.000 | `02-income.png` |
| NPT | Lê Bảo Minh · 12 tháng · 74.400.000 | `04-dependent-expanded.png` |
| Giảm trừ bản thân | 186.000.000 (12 × 15.500.000) | `05-deductions.png` |
| Y tế | 1.000.000 · **không** hiện dòng từ thiện | `05-deductions.png` |
| Tổng giảm trừ | 261.400.000 | API |
| TNTT năm / tháng | 308.600.000 / 25.716.667 · bậc 2 | `06-brackets.png` |
| Thuế phải nộp năm | 24.860.004 | API |
| Hoàn | **8.139.996** · ĐƯỢC HOÀN | `01-hero.png`, `08-summary.png` |
| Glossary | mở được | `09-glossary.png` |

### Kịch bản 2 — Từ thiện 1.000.000 (không chốt)

| Chỉ tiêu | Giá trị | Ảnh |
|----------|---------|-----|
| Đóng góp từ thiện | 1.000.000 (+ ghi chú chứng từ) | `10-deductions-charity.png` |
| Tổng giảm trừ | 262.400.000 | `10-deductions-charity.png` |
| Hoàn | **8.240.004** | `10-deductions-charity.png` |

### Kịch bản 3 — Hồ sơ đã chốt (`cb8a5cf5-…`)

| Chỉ tiêu | Giá trị | Ảnh |
|----------|---------|-----|
| Trạng thái | ĐÃ CHỐT · ĐƯỢC HOÀN **16.864.996** | `11-detail-brackets.png`, `12-detail-income.png` |
| Gross / BH / giảm trừ | 450M / 47.250.000 / 308.650.000 | API + UI |
| TNTT tháng · thuế/tháng | 11.779.167 · 677.917 | `11-detail-brackets.png` |
| Chi tiết nơi chi trả | API `incomeItems=[]` · UI: **「Chưa có nơi chi trả」** | `12-detail-income.png` |

### Kịch bản 4 — Màn nhỏ (`wm size 720x1280`)

| Kết quả | Ảnh |
|---------|-----|
| Layout vẫn đọc được hero + accordion; đã restore size sau chụp | `13-small-screen.png`, `13b-small-screen-scroll.png` |

## Checklist UI (assert Maestro)

| # | Kiểm tra | Kết quả |
|---|----------|---------|
| 1 | Hero preview hoàn / nộp thừa | đạt |
| 2 | Thu nhập: tổng / BH / thuế nguồn / «Gồm N nơi chi trả» | đạt (N=2) |
| 3 | Mở công ty: MST tổ chức | đạt |
| 4 | NPT mở rộng: quan hệ / số tháng | đạt |
| 5 | Giảm trừ charity=0: có BH + y tế; không dòng từ thiện | đạt |
| 6–7 | Bậc thuế + bảng lũy tiến | đạt (06/07 trùng khung — bảng đã thấy trên locked `11`) |
| 8–9 | Kết luận + glossary | đạt |
| 10 | Charity 1M hiện dòng từ thiện + chứng từ | đạt |
| 11–12 | Detail đã chốt: bậc thuế + thu nhập | đạt |
| 13 | Màn nhỏ | đạt (ops emulator, không đổi code) |

## Ghi chú vận hành

1. **Expo Tools FAB** đè nút **Hồ sơ** (góc phải) → mở bằng tọa độ `88%,4%` sau khi đóng menu (`90%,45%`).
2. Dialog Google Password Manager sau login → bấm **Never**.
3. `hideKeyboard` / `pressKey: Back` dễ thoát hẳn màn quyết toán → tránh dùng khi đang ở form charity.
4. Hồ sơ LOCKED cũ **không còn danh sách nơi chi trả** trong GET detail (chỉ còn tổng) — không sửa code; ghi nhận để BE/seed xem lại nếu cần demo đầy đủ accordion Thu nhập trên bản đã chốt.

## Ảnh

Thư mục: `Mobile/FE/.maestro/screenshots/settlement-detail/`  
Flow: `Mobile/FE/.maestro/flows/settlement_result_detail.yaml`
