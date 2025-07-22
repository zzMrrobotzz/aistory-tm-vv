import React, { useState } from 'react';
import { User, Shield, Calendar, Mail, Search } from 'lucide-react';

// Mock data - replace with actual API call
const mockUsers = [
  { id: 'usr_1', username: 'nguyenvana', email: 'nguyenvana@email.com', subscriptionType: 'monthly', expiresAt: '2024-08-15T00:00:00Z', createdAt: '2024-07-15T10:00:00Z' },
  { id: 'usr_2', username: 'tranvanb', email: 'tranvanb@email.com', subscriptionType: 'lifetime', expiresAt: '2099-12-31T00:00:00Z', createdAt: '2024-07-14T11:30:00Z' },
  { id: 'usr_3', username: 'lethic', email: 'lethic@email.com', subscriptionType: 'free', expiresAt: null, createdAt: '2024-07-13T09:00:00Z' },
  { id: 'usr_4', username: 'phamvud', email: 'phamvud@email.com', subscriptionType: 'quarterly', expiresAt: '2024-10-12T00:00:00Z', createdAt: '2024-07-12T15:45:00Z' },
  { id: 'usr_5', username: 'longuserwithaverylongname', email: 'longuserwithaverylongname@email.com', subscriptionType: 'free', expiresAt: null, createdAt: '2024-07-11T08:20:00Z' },
];

const getSubscriptionBadge = (subType: string) => {
    switch (subType) {
        case 'monthly': return <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-200 rounded-full">Tháng</span>;
        case 'quarterly': return <span className="px-2 py-1 text-xs font-semibold text-blue-800 bg-blue-200 rounded-full">Quý</span>;
        case 'lifetime': return <span className="px-2 py-1 text-xs font-semibold text-purple-800 bg-purple-200 rounded-full">Vĩnh viễn</span>;
        default: return <span className="px-2 py-1 text-xs font-semibold text-gray-800 bg-gray-200 rounded-full">Free</span>;
    }
};

const AdminUserManagement: React.FC = () => {
    const [users, setUsers] = useState(mockUsers);
    const [searchTerm, setSearchTerm] = useState('');

    const filteredUsers = users.filter(user =>
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Quản Lý Người Dùng</h1>

            <div className="bg-white p-6 rounded-xl shadow-lg">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold text-gray-700">Danh sách người dùng ({filteredUsers.length})</h2>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Tìm kiếm username hoặc email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg w-64 focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full bg-white">
                        <thead className="bg-gray-100">
                            <tr>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Tài khoản</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Email</th>
                                <th className="py-3 px-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Gói cước</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Ngày hết hạn</th>
                                <th className="py-3 px-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Ngày tạo</th>
                                <th className="py-3 px-4 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">Hành động</th>
                            </tr>
                        </thead>
                        <tbody className="text-gray-700">
                            {filteredUsers.map(user => (
                                <tr key={user.id} className="border-b border-gray-200 hover:bg-gray-50">
                                    <td className="py-4 px-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <User className="h-5 w-5 mr-2 text-gray-500"/>
                                            <span className="font-medium">{user.username}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 whitespace-nowrap">
                                         <div className="flex items-center">
                                            <Mail className="h-5 w-5 mr-2 text-gray-400"/>
                                            <span>{user.email}</span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 text-center">{getSubscriptionBadge(user.subscriptionType)}</td>
                                    <td className="py-4 px-4 whitespace-nowrap">
                                        <div className="flex items-center">
                                            <Calendar className="h-5 w-5 mr-2 text-gray-400"/>
                                            <span>
                                                {user.expiresAt ? new Date(user.expiresAt).toLocaleDateString('vi-VN') : 'N/A'}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="py-4 px-4 whitespace-nowrap">{new Date(user.createdAt).toLocaleDateString('vi-VN')}</td>
                                    <td className="py-4 px-4 text-center">
                                        <button className="text-blue-600 hover:text-blue-800 font-medium">Chi tiết</button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                {filteredUsers.length === 0 && (
                     <div className="text-center py-8">
                        <p className="text-gray-500">Không tìm thấy người dùng nào.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminUserManagement; 