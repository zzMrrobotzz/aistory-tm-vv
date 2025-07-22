import React, { useState } from 'react';
import { Gift, DollarSign, Edit, Trash2, PlusCircle } from 'lucide-react';

// Mock data
const mockPlans = [
  { id: 'monthly', name: 'Gói Tháng', price: 400000, durationMonths: 1, description: 'Sử dụng tất cả tính năng trong 1 tháng.', isActive: true, isPopular: false },
  { id: 'quarterly', name: 'Gói Quý', price: 1000000, durationMonths: 3, description: 'Tiết kiệm hơn với gói 3 tháng.', isActive: true, isPopular: true },
  { id: 'lifetime', name: 'Gói Vĩnh Viễn', price: 2000000, durationMonths: 999, description: 'Mua một lần, dùng mãi mãi.', isActive: true, isPopular: false },
  { id: 'old_plan', name: 'Gói cũ không hoạt động', price: 50000, durationMonths: 1, description: 'Gói này đã bị vô hiệu hóa.', isActive: false, isPopular: false },
];

const AdminSubscriptionPlans: React.FC = () => {
    const [plans, setPlans] = useState(mockPlans);

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Quản Lý Gói Cước</h1>
            <div className="flex justify-end">
                <button className="flex items-center px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700">
                    <PlusCircle className="h-5 w-5 mr-2" />
                    Thêm Gói Mới
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {plans.map(plan => (
                    <div key={plan.id} className={`bg-white rounded-xl shadow-lg p-6 flex flex-col justify-between transition-all duration-300 ${!plan.isActive ? 'opacity-50 bg-gray-100' : 'hover:shadow-xl hover:-translate-y-1'}`}>
                        <div>
                            {plan.isPopular && (
                                <div className="text-xs font-bold text-purple-600 bg-purple-100 px-3 py-1 rounded-full inline-block mb-3">Phổ biến</div>
                            )}
                            <h3 className="text-xl font-bold text-gray-800">{plan.name}</h3>
                            <p className="text-3xl font-extrabold text-blue-600 my-3">
                                {plan.price.toLocaleString('vi-VN')}
                                <span className="text-lg font-medium text-gray-500"> VNĐ</span>
                            </p>
                            <p className="text-gray-600 text-sm mb-4 h-12">{plan.description}</p>
                            <div className="border-t border-gray-200 pt-4 text-sm space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Mã gói (ID):</span>
                                    <span className="font-semibold text-gray-700">{plan.id}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Thời hạn:</span>
                                    <span className="font-semibold text-gray-700">{plan.durationMonths >= 999 ? 'Vĩnh viễn' : `${plan.durationMonths} tháng`}</span>
                                </div>
                                 <div className="flex justify-between">
                                    <span className="text-gray-500">Trạng thái:</span>
                                    {plan.isActive ? 
                                        <span className="font-semibold text-green-600">Đang hoạt động</span> : 
                                        <span className="font-semibold text-red-600">Không hoạt động</span>
                                    }
                                </div>
                            </div>
                        </div>
                        <div className="mt-6 flex gap-2">
                            <button className="w-full flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200">
                                <Edit className="h-4 w-4 mr-2"/> Sửa
                            </button>
                            <button className="px-4 py-2 bg-red-100 text-red-700 font-semibold rounded-lg hover:bg-red-200">
                                <Trash2 className="h-4 w-4"/>
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AdminSubscriptionPlans; 