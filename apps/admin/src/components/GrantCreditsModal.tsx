import React, { useState } from 'react';
import { AdminUser } from '../types';

interface GrantCreditsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onGrant: (userId: string, amount: number) => void;
    users: AdminUser[];
}

export const GrantCreditsModal: React.FC<GrantCreditsModalProps> = ({ isOpen, onClose, onGrant, users }) => {
    const [selectedUserId, setSelectedUserId] = useState<string>('');
    const [amount, setAmount] = useState<number>(100);
    const [reason, setReason] = useState('');

    const handleGrantClick = () => {
        if (!selectedUserId) {
            alert('Vui lòng chọn một người dùng.');
            return;
        }
        if (amount <= 0) {
            alert('Số credits phải lớn hơn 0.');
            return;
        }
        // In a real app, 'reason' would be logged.
        onGrant(selectedUserId, amount);
    };

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-50 flex justify-center items-center"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg animate-fadeIn"
                onClick={e => e.stopPropagation()}
            >
                <h2 className="text-2xl font-bold text-gray-800 mb-4">
                    Cấp Credit Thủ Công
                </h2>
                
                <div className="space-y-4">
                    <div>
                        <label htmlFor="user-select" className="block text-sm font-medium text-gray-700 mb-1">Chọn Người Dùng</label>
                        <select
                            id="user-select"
                            value={selectedUserId}
                            onChange={(e) => setSelectedUserId(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg"
                        >
                            <option value="" disabled>-- Chọn một người dùng --</option>
                            {users.map(user => (
                                <option key={user.id} value={user.id}>
                                    {user.name} ({user.email}) - Hiện có: {user.credits.toLocaleString()} credits
                                </option>
                            ))}
                        </select>
                    </div>
                     <div>
                        <label htmlFor="credit-amount" className="block text-sm font-medium text-gray-700 mb-1">Số Credits Cần Cấp</label>
                        <input
                            type="number"
                            id="credit-amount"
                            value={amount}
                            onChange={(e) => setAmount(parseInt(e.target.value, 10))}
                            className="w-full p-2 border border-gray-300 rounded-lg"
                            placeholder="Nhập số credits"
                            min="1"
                        />
                    </div>
                     <div>
                        <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-1">Lý do (Không bắt buộc)</label>
                        <input
                            type="text"
                            id="reason"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-lg"
                            placeholder="Ví dụ: Ghi nhận thanh toán qua Zalo, Tặng thưởng..."
                        />
                    </div>
                </div>

                <div className="mt-6 flex justify-end space-x-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300"
                    >
                        Hủy
                    </button>
                    <button
                        onClick={handleGrantClick}
                        className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700"
                    >
                        Xác nhận Cấp Credits
                    </button>
                </div>
            </div>
        </div>
    );
}; 