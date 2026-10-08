# Round 2 — Maestro settlement UI (sau sửa a/b)

**Ngày:** 2026-10-08 · TK Lê Văn Đức · `emulator-5554`  
**Trước chạy:** Reload Expo (nút Reload)  
**Không:** sửa code · chốt hồ sơ · xuất PDF/ZIP  
**Ảnh:** `.maestro/screenshots/settlement-detail/round2/`

| Bước | Đạt/Lỗi | Ảnh | Ghi chú |
|------|---------|-----|---------|
| Reload app rồi mở xem trước 2026, charity=0 | đạt | — | Home → Quyết toán → Xem trước |
| Mở 04 Bậc thuế (đầu bảng) | đạt | `r2-01-brackets-top.png` | Cột Phần thu nhập: **`0 – 10.000.000`**, **`10.000.000 – 30.000.000`** — **không** còn `đ` riêng dòng. Nút Chốt che phần dưới bảng ở viewport này (đúng kỳ vọng → cần cuộn). |
| Cuộn tới hết phần dưới bảng | đạt | `r2-02-brackets-bottom.png` | Thấy đủ: **Thuế mỗi tháng 2.071.667 đ**, **Thuế phải nộp cả năm (× 12) 24.860.004 đ**, ô «…giống tiền điện…» + «khớp với công thức rút gọn». **Không** bị nút Chốt che. |
| Sửa (a) — label Bản thân | đạt | `r2-03-deductions.png` | `Bản thân (12 tháng × 15.500.000)` — **không** rớt `đ` trong ngoặc; số `186.000.000 đ` cùng dòng. |
| Màn nhỏ 720×1280 — bảng bậc thuế (trên) | **lỗi layout** | `r2-04-small-brackets.png` | Viewport hẹp: tiêu đề bảng / cột dễ bị lệch; phần bảng khó đọc full (so với full-HD). |
| Màn nhỏ — dưới bảng | **một phần** | `r2-05-small-brackets-bottom.png` | Thấy **Thuế mỗi tháng** + **Thuế phải nộp cả năm**. Ô ghi chú **bị nút Chốt cắt** nửa dưới → **không** thấy hết «khớp với công thức rút gọn» trên cùng viewport. |
| Màn nhỏ — Thu nhập + công ty | **lỗi tràn** | `r2-06-small-income.png` | Tên công ty **bọc dọc từng mảnh** (`Tập` / `đoà` / `n C` / …) — không đọc được. Giá trị tổng thu nhập phía phải bị **cắt/che** (Tools + mép phải). |
| `wm size reset` | đạt | — | Lại `1080x2424` |
| Sửa (b) — hồ sơ chốt không có list nơi chi trả | đạt | `r2-07-detail-income.png` | `cb8a5cf5-…` · 01 Thu nhập hiện đúng: **«Hồ sơ này không lưu chi tiết từng nơi chi trả, chỉ còn số tổng.»** |

## Kết luận nhanh

- **(a) full size:** đạt (khoảng bậc + Bản thân).  
- **(b) hồ sơ chốt:** đạt (câu mới).  
- **720×1280:** bảng/note/income **vẫn có vấn đề tràn/cắt/che** — ghi nhận, không sửa code trong round này.
