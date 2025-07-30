# 🎯 Tính Năng Thống Kê Độ Nhất Quán và Hoàn Thiện Câu Chuyện

## 📋 Tổng Quan
Tính năng mới này thêm khả năng phân tích và đánh giá độ nhất quán cũng như hoàn thiện của câu chuyện sau khi viết lại trong **Module Viết Lại (Rewrite Module)**.

## ✨ Tính Năng Chính

### 1. 📊 Phân Tích Chất Lượng Câu Chuyện
- **Tính Nhất Quán (Consistency Score)**: 0-100%
  - Đánh giá sự nhất quán của nhân vật, bối cảnh, thời gian
- **Độ Hoàn Thiện (Completeness Score)**: 0-100%
  - Đánh giá cấu trúc câu chuyện có đầu-giữa-cuối rõ ràng
- **Chất Lượng Tổng Thể (Overall Quality Score)**: 0-100%
  - Điểm trung bình của tính nhất quán và độ hoàn thiện

### 2. 🔍 Phân Tích Chi Tiết
- **Tính nhất quán nhân vật**: Phân tích tên, tính cách, hành động của nhân vật
- **Tính logic cốt truyện**: Đánh giá mạch truyện có hợp lý không
- **Tính nhất quán thời gian**: Kiểm tra timeline có mâu thuẫn không
- **Tính nhất quán bối cảnh**: Đánh giá môi trường, địa điểm trong câu chuyện
- **Đánh giá tổng quan**: Nhận xét chung về chất lượng câu chuyện

### 3. 📈 Hiển Thị Trực Quan
- **Progress bars** hiển thị phần trăm cho từng tiêu chí
- **Màu sắc phân biệt**: Purple (nhất quán), Pink (hoàn thiện), Indigo (tổng thể)
- **Chi tiết có thể mở rộng** để xem phân tích đầy đủ

## 🚀 Cách Sử Dụng

### Đối với Viết Lại Đơn Lẻ:
1. Nhập văn bản gốc cần viết lại (tối thiểu 500 ký tự)
2. Cấu hình cài đặt viết lại
3. Nhấn "Viết lại nội dung"
4. Sau khi hoàn thành, thống kê chất lượng sẽ xuất hiện bên dưới kết quả

### Đối với Hàng Chờ (Queue):
1. Bật chế độ "Hệ Thống Hàng Chờ"
2. Thêm nhiều văn bản vào hàng chờ
3. Bắt đầu xử lý hàng chờ
4. Mỗi item hoàn thành sẽ có thống kê chất lượng riêng

### Trong Lịch Sử Gần Đây:
- Các bài viết có thống kê sẽ hiển thị điểm tổng thể
- Hiển thị mini progress bar và điểm chi tiết
- Lưu trữ cả thống kê từ và thống kê chất lượng

## 🎨 Giao Diện

### Thống Kê Chất Lượng - Viết Lại Đơn Lẻ:
```
🎯 Đánh Giá Chất Lượng Câu Chuyện
┌─────────────────────────────────────┐
│ [85%]     [90%]     [87%]           │
│ Nhất quán Hoàn thiện Tổng thể        │
│                                     │
│ ████████████████ 85% Nhất quán      │
│ ████████████████ 90% Hoàn thiện     │
│ ████████████████ 87% Tổng thể       │
│                                     │
│ 📋 Xem phân tích chi tiết           │
└─────────────────────────────────────┘
```

### Lịch Sử Gần Đây:
```
📚 Lịch sử gần đây (3)
┌─────────────────────────────────────┐
│ Viết lại - 30/07/2025, 14:50       │
│ "Tôi là Lan, năm nay ba mười tám tuổi..." │
│                                     │
│ 🎯 Chất lượng: 87%                  │
│ Nhất quán: 85% | Hoàn thiện: 90%    │
│ ████████████████ 87%                │
│                                     │
│ 📊 Từ gốc: 7,007 | % thay đổi: 52%  │
└─────────────────────────────────────┘
```

## ⚙️ Cấu Hình Kỹ Thuật

### Điều Kiện Kích Hoạt:
- Chỉ phân tích các văn bản có độ dài > 500 ký tự
- Tránh lãng phí API cho các văn bản ngắn

### Lưu Trữ:
- Thống kê được lưu vào `localStorage` cùng với lịch sử
- Metadata bao gồm cả `wordStats` và `storyQualityStats`

### API Sử Dụng:
- Sử dụng same API như text generation (Gemini/OpenAI/etc.)
- Prompt được tối ưu để trả về JSON format

## 🔧 Files Đã Thay Đổi:

1. **`types.ts`**:
   - Thêm `storyQualityStats` vào `RewriteQueueItem`
   - Thêm `storyQualityAnalysis` vào `RewriteModuleState`
   - Cập nhật `HistoryItem` với metadata

2. **`RewriteModule.tsx`**:
   - Thêm hàm `analyzeStoryQuality()`
   - Cập nhật `processQueueItem()` và `handleSingleRewrite()`
   - Thêm UI components hiển thị thống kê
   - Lưu thống kê vào lịch sử

3. **`historyStorage.ts`**:
   - Hỗ trợ metadata trong `saveToHistory()`
   - Cập nhật `HistoryItem` interface

4. **`HistoryPanel.tsx`**:
   - Hiển thị thống kê chất lượng trong lịch sử
   - Mini progress bars và điểm số

## 🎯 Lợi Ích

### Cho Người Dùng:
- **Đánh giá khách quan** chất lượng câu chuyện sau viết lại
- **Nhận biết vấn đề** như mâu thuẫn nhân vật, timeline
- **So sánh các phiên bản** viết lại khác nhau
- **Tiết kiệm thời gian** kiểm tra thủ công

### Cho Hệ Thống:
- **Feedback loop** để cải thiện prompt viết lại
- **Data insights** về chất lượng output
- **User experience** được nâng cao đáng kể

## 🚀 Tương Lai

### Potential Enhancements:
- Thêm tiêu chí đánh giá khác (độ sáng tạo, cảm xúc, etc.)
- Xuất báo cáo chi tiết dạng PDF
- So sánh chất lượng giữa các mức độ viết lại
- Machine learning để cải thiện accuracy

---

Tính năng này giúp người dùng có cái nhìn khách quan về chất lượng câu chuyện sau khi viết lại, từ đó có thể điều chỉnh cài đặt hoặc chỉnh sửa thêm để đạt được kết quả mong muốn.
