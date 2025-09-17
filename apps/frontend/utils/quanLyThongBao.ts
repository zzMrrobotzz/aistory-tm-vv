// Tiện ích quản lý hiển thị thông báo với cooldown 24 tiếng
export class QuanLyThongBao {
    private static readonly KHOA_LUU_TRU = 'lanCuoiHienThiThongBao';
    private static readonly THOI_GIAN_CHO = 24 * 60 * 60 * 1000; // 24 tiếng tính bằng mili giây

    // Kiểm tra có nên hiển thị popup không (cooldown 24h)
    static coNenHienPopup(): boolean {
        const lanHienCuoi = localStorage.getItem(this.KHOA_LUU_TRU);

        if (!lanHienCuoi) {
            return true; // Lần đầu tiên, hiển thị popup
        }

        const thoiGianHienCuoi = parseInt(lanHienCuoi);
        const thoiGianHienTai = Date.now();
        const khoangCachThoiGian = thoiGianHienTai - thoiGianHienCuoi;

        return khoangCachThoiGian >= this.THOI_GIAN_CHO;
    }

    // Đánh dấu đã hiển thị popup với thời gian hiện tại
    static danhDauDaHien(): void {
        localStorage.setItem(this.KHOA_LUU_TRU, Date.now().toString());
        console.log('📢 Đã đánh dấu thông báo đã hiển thị:', new Date().toLocaleString('vi-VN'));
    }

    // Lấy thời gian còn lại đến lần hiển thị tiếp theo
    static layThoiGianConLai(): number {
        const lanHienCuoi = localStorage.getItem(this.KHOA_LUU_TRU);

        if (!lanHienCuoi) {
            return 0;
        }

        const thoiGianHienCuoi = parseInt(lanHienCuoi);
        const thoiGianHienTai = Date.now();
        const khoangCachThoiGian = thoiGianHienTai - thoiGianHienCuoi;

        return Math.max(0, this.THOI_GIAN_CHO - khoangCachThoiGian);
    }

    // Reset cooldown (để test hoặc admin dùng)
    static resetThoiGianCho(): void {
        localStorage.removeItem(this.KHOA_LUU_TRU);
        console.log('🔄 Đã reset thời gian chờ thông báo');
    }

    // Lấy chuỗi thời gian còn lại dễ đọc
    static layChuoiThoiGianConLai(): string {
        const conLai = this.layThoiGianConLai();

        if (conLai === 0) {
            return 'Có thể hiển thị ngay';
        }

        const gio = Math.floor(conLai / (60 * 60 * 1000));
        const phut = Math.floor((conLai % (60 * 60 * 1000)) / (60 * 1000));

        if (gio > 0) {
            return `Còn ${gio} tiếng ${phut} phút nữa`;
        } else {
            return `Còn ${phut} phút nữa`;
        }
    }

    // Debug: Lấy thông tin chi tiết về trạng thái hiện tại
    static layThongTinDebug(): string {
        const lanHienCuoi = localStorage.getItem(this.KHOA_LUU_TRU);

        if (!lanHienCuoi) {
            return 'Chưa hiển thị popup lần nào';
        }

        const thoiGianHienCuoi = parseInt(lanHienCuoi);
        const ngayHienCuoi = new Date(thoiGianHienCuoi);

        return `Lần cuối hiển thị: ${ngayHienCuoi.toLocaleString('vi-VN')} | ${this.layChuoiThoiGianConLai()}`;
    }
}