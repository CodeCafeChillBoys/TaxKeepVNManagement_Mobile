# Minh chứng flow Quyết toán thuế (Maestro + API)

Thời điểm: 2026-09-29 22:02
Tài khoản test: 079201077700

## Workflow FE khớp BE

| Bước UI | API BE | Kết quả kiểm |
|---|---|---|
| S1 Start chọn năm | — | OK |
| S2 Xem trước | `POST /api/v1/tax-settlements/preview` | status=DRAFT, không tăng list |
| Sheet xác nhận | — | OK |
| S3 Đã chốt | `POST /api/v1/tax-settlements/export` | HTTP 201, status=LOCKED + dossierId |
| S4 Danh sách | `GET /api/v1/tax-settlements` | các hồ sơ LOCKED |
| S5 Chi tiết | `GET /api/v1/tax-settlements/{id}` | ĐÃ CHỐT, số liệu khớp preview |

Năm 2026 (luật 5 bậc): hoàn **11.595.000 đ** (payable 405.000 − withheld 12.000.000).

Chi tiết API: `api-workflow-report.txt`

## Ảnh

1. `01-settlement-start.png`
2. `02-settlement-preview.png`
3. `03-settlement-confirm.png`
4. `04-settlement-success.png`
5. `05-settlement-list.png`
6. `06-settlement-detail.png`
