# Round 3 — Maestro settlement UI (layout thẻ + màn nhỏ đúng density)

**Ngày:** 2026-10-08 · TK Lê Văn Đức · `emulator-5554`  
**Giả lập nhỏ:** `wm size 720x1280` + `wm density 320` (~360dp)  
**Sau test:** `wm size reset` + `wm density reset` → `1080x2424` / density `420`  
**Không:** sửa code · chốt · xuất hồ sơ  

| Bước | Đạt/Lỗi | Ảnh | Ghi chú |
|------|---------|-----|---------|
| Reload + vào xem trước 2026 charity=0 | đạt | — | Home → Quyết toán → Xem trước |
| Small: 01 Thu nhập · mở Viettel | **đạt** | `r3-01-small-income.png` | Tên đọc được, wrap theo từ (không gãy ký tự). **450.000.000 đ** nằm **dưới** tên. Dòng nhãn–giá trị (tổng / BH / thuế nguồn) không bị co. BH công ty bị mép nút Chốt che nhẹ khi cuộn ít. |
| Small: 02 NPT · mở Lê Bảo Minh | **đạt** | `r3-02-small-dependent.png` | Tên 1 dòng; **74.400.000 đ** dưới tên/«Con · 12 tháng». Quan hệ / thời gian / số tháng / cách tính rõ, không cắt. |
| Small: 04 bảng (header + 2 bậc) | **một phần** | `r3-03-small-brackets.png` | 4 cột **không chồng**. Header «Phần thu nhập» wrap 2 dòng (ổn). Bậc 1: số `10.000.000` rồi **`đ` rớt dòng riêng** trong cột Phần thu nhập. Bậc 2: `15.716.667 đ` cùng dòng. Số thuế không bị cắt mép. |
| Small: cuộn hết ghi chú dưới bảng | **đạt** | `r3-04-small-brackets-bottom.png` | Thấy Thuế mỗi tháng / cả năm + ô ghi chú đầy đủ; **không** bị Chốt che. (Viewport cuộn làm mép trên bậc 1 chỉ còn chữ `đ` — artifact cuộn, không phải chồng cột.) |
| Small: 03 Giảm trừ | **đạt** | `r3-05-small-deductions.png` | Giá trị phải không co. Label `Bản thân (12 tháng × 15.500.000)` wrap xuống dòng sau `×` (không rớt `đ` lẻ). |
| Reset size + density | **đạt** | — | `1080x2424`, density `420` |
| Normal: 01 Thu nhập · mở công ty | **đạt** | `r3-06-normal-income.png` | Bố cục mới ổn: số dưới tên; Viettel + ABC; nhãn–giá trị trong thẻ rõ. |

## Kết luận

- **Thẻ công ty / NPT (số dưới tên):** đạt trên màn nhỏ (~360dp) và màn thường.  
- **Màn nhỏ đúng density:** tốt hơn round2 nhiều (không còn gãy từng ký tự).  
- **Còn lại:** cột «Phần thu nhập» bậc 1 vẫn có **`đ` xuống dòng riêng** cạnh số `10.000.000` khi hẹp.
