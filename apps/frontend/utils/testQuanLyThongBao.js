// Script test cho QuanLyThongBao
// Chạy script này trong Browser Console để test cooldown mechanism

console.log('🧪 Testing QuanLyThongBao Cooldown System');
console.log('=====================================');

// Import class (nếu có thể, hoặc copy-paste code)
// import { QuanLyThongBao } from './quanLyThongBao';

// Helper function để test
function testQuanLyThongBao() {
    console.log('\n📊 TRẠNG THÁI HIỆN TẠI:');
    console.log('- localStorage key:', 'lanCuoiHienThiThongBao');
    console.log('- Giá trị hiện tại:', localStorage.getItem('lanCuoiHienThiThongBao'));

    // Test 1: Kiểm tra trạng thái ban đầu
    console.log('\n🔍 TEST 1: Kiểm tra trạng thái ban đầu');
    console.log('- Có nên hiển thị popup?', QuanLyThongBao ? QuanLyThongBao.coNenHienPopup() : 'QuanLyThongBao chưa được import');

    if (typeof QuanLyThongBao !== 'undefined') {
        console.log('- Thông tin debug:', QuanLyThongBao.layThongTinDebug());
        console.log('- Thời gian còn lại:', QuanLyThongBao.layChuoiThoiGianConLai());

        // Test 2: Đánh dấu đã hiển thị
        console.log('\n📝 TEST 2: Đánh dấu đã hiển thị');
        QuanLyThongBao.danhDauDaHien();
        console.log('- Sau khi đánh dấu:');
        console.log('  + Có nên hiển thị popup?', QuanLyThongBao.coNenHienPopup());
        console.log('  + Thông tin debug:', QuanLyThongBao.layThongTinDebug());
        console.log('  + Thời gian còn lại:', QuanLyThongBao.layChuoiThoiGianConLai());

        // Test 3: Các helper functions
        console.log('\n🛠️ TEST 3: Helper functions');
        console.log('- Thời gian còn lại (ms):', QuanLyThongBao.layThoiGianConLai());

        // Test 4: Reset functionality
        console.log('\n🔄 TEST 4: Reset functionality');
        console.log('- Trước reset:', QuanLyThongBao.coNenHienPopup());
        QuanLyThongBao.resetThoiGianCho();
        console.log('- Sau reset:', QuanLyThongBao.coNenHienPopup());
        console.log('- localStorage sau reset:', localStorage.getItem('lanCuoiHienThiThongBao'));
    }
}

// Test scenarios khác nhau
function testScenarios() {
    if (typeof QuanLyThongBao === 'undefined') {
        console.log('❌ QuanLyThongBao không available. Import trước khi test.');
        return;
    }

    console.log('\n🎭 TESTING SCENARIOS:');

    // Scenario 1: User mới (chưa từng thấy popup)
    console.log('\n📱 Scenario 1: User mới');
    QuanLyThongBao.resetThoiGianCho();
    console.log('- Có nên hiển thị?', QuanLyThongBao.coNenHienPopup()); // Phải là true

    // Scenario 2: User đã thấy popup trong 24h
    console.log('\n⏰ Scenario 2: User đã thấy popup gần đây');
    QuanLyThongBao.danhDauDaHien();
    console.log('- Có nên hiển thị?', QuanLyThongBao.coNenHienPopup()); // Phải là false
    console.log('- Thời gian còn lại:', QuanLyThongBao.layChuoiThoiGianConLai());

    // Scenario 3: Simulate 25 tiếng trước (>24h)
    console.log('\n🕰️ Scenario 3: Simulate >24h ago');
    const now = Date.now();
    const twentyFiveHoursAgo = now - (25 * 60 * 60 * 1000);
    localStorage.setItem('lanCuoiHienThiThongBao', twentyFiveHoursAgo.toString());
    console.log('- Set thời gian: 25 tiếng trước');
    console.log('- Có nên hiển thị?', QuanLyThongBao.coNenHienPopup()); // Phải là true
    console.log('- Thông tin debug:', QuanLyThongBao.layThongTinDebug());
}

// Quick test functions cho browser console
window.testQuanLyThongBao = testQuanLyThongBao;
window.testScenarios = testScenarios;
window.resetAnnouncementCooldown = () => {
    if (typeof QuanLyThongBao !== 'undefined') {
        QuanLyThongBao.resetThoiGianCho();
        console.log('✅ Đã reset cooldown. Refresh trang để test.');
    } else {
        localStorage.removeItem('lanCuoiHienThiThongBao');
        console.log('✅ Đã xóa localStorage key. Refresh trang để test.');
    }
};

// Usage instructions
console.log('\n📖 CÁCH SỬ DỤNG:');
console.log('1. Mở Browser Console (F12)');
console.log('2. Chạy: testQuanLyThongBao()');
console.log('3. Chạy: testScenarios()');
console.log('4. Để reset cooldown: resetAnnouncementCooldown()');
console.log('5. Để check localStorage: localStorage.getItem("lanCuoiHienThiThongBao")');

// Auto run basic test
if (typeof QuanLyThongBao !== 'undefined') {
    setTimeout(() => {
        console.log('\n🚀 AUTO RUNNING BASIC TEST...');
        testQuanLyThongBao();
    }, 1000);
}