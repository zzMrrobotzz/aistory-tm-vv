import React, { useState } from 'react';

const AdminSettings: React.FC = () => {
    const [maintenanceMode, setMaintenanceMode] = useState(false);
    const [enableNewFeature, setEnableNewFeature] = useState(true);
    const [announcement, setAnnouncement] = useState('');

    const handleSave = () => {
        // In a real app, this would make an API call to the backend
        console.log("Saving settings:", { maintenanceMode, enableNewFeature, announcement });
        alert("Cài đặt đã được lưu (giả lập)!");
    };

    return (
        <div className="space-y-8 animate-fadeIn max-w-4xl">
            <h1 className="text-3xl font-bold text-gray-800">Cài Đặt Hệ Thống</h1>

            {/* General Settings */}
            <div className="bg-white p-6 rounded-xl shadow-md">
                <h2 className="text-lg font-semibold text-gray-700 border-b pb-3 mb-4">Cài đặt Chung</h2>
                <div className="space-y-6">
                    {/* Maintenance Mode */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-gray-800">Chế độ Bảo trì</p>
                            <p className="text-sm text-gray-500">Khi được bật, người dùng sẽ thấy trang thông báo bảo trì.</p>
                        </div>
                        <label htmlFor="maintenance-toggle" className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="maintenance-toggle" className="sr-only peer" checked={maintenanceMode} onChange={() => setMaintenanceMode(!maintenanceMode)} />
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-sky-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                        </label>
                    </div>

                    {/* Announcement Banner */}
                    <div>
                        <label htmlFor="announcement" className="block font-medium text-gray-800 mb-1">Thông báo Toàn cục</label>
                         <p className="text-sm text-gray-500 mb-2">Nhập một tin nhắn để hiển thị dưới dạng banner cho tất cả người dùng. Để trống để không hiển thị.</p>
                        <input
                            type="text"
                            id="announcement"
                            value={announcement}
                            onChange={(e) => setAnnouncement(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-sky-500"
                            placeholder="Ví dụ: Nâng cấp hệ thống vào lúc 2h sáng."
                        />
                    </div>
                </div>
            </div>

             {/* Feature Flags */}
            <div className="bg-white p-6 rounded-xl shadow-md">
                 <h2 className="text-lg font-semibold text-gray-700 border-b pb-3 mb-4">Cờ Tính Năng (Feature Flags)</h2>
                 <div className="space-y-6">
                    {/* Example Feature Flag */}
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="font-medium text-gray-800">Bật Module "Dream 100"</p>
                            <p className="text-sm text-gray-500">Bật hoặc tắt module phân tích đối thủ cho tất cả người dùng.</p>
                        </div>
                        <label htmlFor="feature-toggle" className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" id="feature-toggle" className="sr-only peer" checked={enableNewFeature} onChange={() => setEnableNewFeature(!enableNewFeature)} />
                            <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-4 peer-focus:ring-sky-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-sky-600"></div>
                        </label>
                    </div>
                 </div>
            </div>

            {/* Save Button */}
            <div className="flex justify-end">
                <button
                    onClick={handleSave}
                    className="bg-sky-600 text-white font-bold py-2 px-6 rounded-lg shadow-md hover:bg-sky-700 transition-colors"
                >
                    Lưu Thay Đổi
                </button>
            </div>
        </div>
    );
};

export default AdminSettings; 