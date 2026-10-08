# Báo cáo Maestro — Thu nhập theo tháng + OCR

**Nhánh FE:** `feature/income-monthly-ocr`  
**Ảnh bằng chứng:** `.maestro/screenshots/income-monthly/01`–`20`  
**Asset OCR:** `.maestro/assets/income-monthly/` (`payslip.jpg`, `not-payslip.jpg`)  
**Flow chính:** `income_monthly.yaml` · `income_monthly_manual.yaml` · `income_monthly_ocr.yaml` · `income_monthly_viewer_scanerror.yaml`

## Kết quả

| # | Bước | Đạt | Ảnh |
|---|------|-----|-----|
| 1 | Bật chế độ theo tháng | Đạt | `01-toggle.png` |
| 2 | Năm trống (2024) | Đạt | `02-empty-2024.png` |
| 3 | Validation form | Đạt | `03-validation.png` |
| 4 | Form đã điền | Đạt | `04-form-filled.png` |
| 5 | List sau tạo | Đạt | `05-list-after-create.png` |
| 6 | Mở rộng chi tiết | Đạt | `06-expanded.png` |
| 7 | Cảnh báo trùng | Đạt | `07-duplicate-warning.png` |
| 8 | Alert trùng | Đạt | `08-duplicate-alert.png` |
| 9 | Sau sửa | Đạt | `09-after-edit.png` |
| 10 | OCR đang đọc | Đạt | `10-ocr-loading.png` |
| 11 | OCR kết quả (tin cậy cao, khớp phiếu) | Đạt | `11-ocr-result.png` |
| 12 | List sau OCR + lưu | Đạt | `12-list-after-ocr.png` |
| 13 | OCR ảnh không phải phiếu (lỗi form) | Đạt | `13-ocr-error.png` |
| 14 | Sau xóa | Đạt | `14-after-delete.png` |
| 15 | Chế độ theo năm vẫn ổn | Đạt | `15-yearly-still-works.png` |
| 16 | Nút thêm 1 dòng | Đạt | `16-add-button.png` |
| 17 | Lỗi đỏ chung tự ẩn khi sửa | Đạt | `17-error-cleared.png` |
| 18 | Viewer in-app (không mở trình duyệt) | Đạt | `18-viewer.png` |
| 19 | Đóng X → form còn nguyên | Đạt | `19-form-kept.png` |
| 20 | Lỗi OCR dưới nút Chụp/Chọn | Đạt | `20-scan-error.png` |

Retest 18–20 (2026-10-09): model `gemini-flash-lite-latest`; **không Lưu** → không tạo bản ghi mới.

## OCR vs `payslip.jpg`

| Trường | Phiếu | AI | Khớp |
|--------|-------|-----|------|
| Tổ chức | CONG TY TNHH DEMO PAYSLIP OCR | CÔNG TY TNHH DEMO PAYSLIP OCR | Đạt |
| MST | 0312345678 | 0312345678 | Đạt |
| Tháng/Năm | 03/2026 | 3 / 2026 | Đạt |
| Chịu thuế | 25.000.000 | 25.000.000 | Đạt |
| Bảo hiểm | 2.625.000 | 2.625.000 | Đạt |
| Thuế KH | 1.200.000 | 1.200.000 | Đạt |

Câu lỗi not-payslip: *Hình ảnh tải lên không được nhận diện là Phiếu lương hoặc Báo cáo thu nhập hợp lệ.*

## Chạy lại

```bash
# Thủ công + OCR đủ (cần AI :8000 + BE + Gemini)
maestro test .maestro/flows/income_monthly.yaml \
  -e TEST_USER_ID=... -e TEST_USER_PASSWORD=...

# Chỉ viewer + scanError, không lưu
maestro test .maestro/flows/income_monthly_viewer_scanerror.yaml \
  -e TEST_USER_ID=... -e TEST_USER_PASSWORD=...
```
