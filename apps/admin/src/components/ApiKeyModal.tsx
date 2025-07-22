import React, { useState, useEffect } from 'react';
import { ManagedApiKey, ApiProviderType } from '../types';

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (key: ManagedApiKey) => void;
    existingKey: ManagedApiKey | null;
}

export const ApiKeyModal: React.FC<ApiKeyModalProps> = ({ isOpen, onClose, onSave, existingKey }) => {
    const [keyData, setKeyData] = useState<Partial<ManagedApiKey>>({
        provider: 'Gemini',
        nickname: '',
        key: '',
        status: 'Active',
        usage: 'N/A',
        ...existingKey
    });
    
    useEffect(() => {
        if (existingKey) {
            setKeyData(existingKey);
        } else {
            setKeyData({
                id: Date.now().toString(),
                provider: 'Gemini',
                nickname: '',
                key: '',
                status: 'Active',
                usage: 'N/A',
                lastChecked: new Date().toISOString()
            });
        }
    }, [existingKey, isOpen]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setKeyData(prev => ({ ...prev, [name]: value }));
    };

    const handleSaveClick = () => {
        // Basic validation
        if (!keyData.nickname || !keyData.key) {
            alert('Vui lòng nhập Tên Gợi Nhớ và API Key.');
            return;
        }
        onSave(keyData as ManagedApiKey);
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
                    {existingKey ? 'Sửa API Key' : 'Thêm API Key Mới'}
                </h2>
                
                <div className="space-y-4">
                    <div>
                        <label htmlFor="provider" className="block text-sm font-medium text-gray-700 mb-1">Nhà Cung Cấp</label>
                        <select
                            id="provider"
                            name="provider"
                            value={keyData.provider}
                            onChange={handleChange}
                            className="w-full p-2 border border-gray-300 rounded-lg"
                        >
                            <option value="Gemini">Gemini</option>
                            <option value="ElevenLabs">ElevenLabs</option>
                            <option value="Stability AI">Stability AI</option>
                            <option value="OpenAI">OpenAI</option>
                            <option value="DeepSeek">DeepSeek</option>
                        </select>
                    </div>
                     <div>
                        <label htmlFor="nickname" className="block text-sm font-medium text-gray-700 mb-1">Tên Gợi Nhớ</label>
                        <input
                            type="text"
                            id="nickname"
                            name="nickname"
                            value={keyData.nickname}
                            onChange={handleChange}
                            className="w-full p-2 border border-gray-300 rounded-lg"
                            placeholder="Ví dụ: Key Gemini chính cho viết truyện"
                        />
                    </div>
                     <div>
                        <label htmlFor="key" className="block text-sm font-medium text-gray-700 mb-1">API Key</label>
                        <input
                            type="password"
                            id="key"
                            name="key"
                            value={keyData.key}
                            onChange={handleChange}
                            className="w-full p-2 border border-gray-300 rounded-lg font-mono"
                            placeholder="Dán API Key vào đây"
                        />
                    </div>
                    <div>
                        <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">Trạng Thái</label>
                        <select
                            id="status"
                            name="status"
                            value={keyData.status}
                            onChange={handleChange}
                            className="w-full p-2 border border-gray-300 rounded-lg"
                        >
                            <option value="Active">Active (Hoạt động)</option>
                            <option value="Inactive">Inactive (Không hoạt động)</option>
                            <option value="Depleted">Depleted (Hết hạn ngạch)</option>
                        </select>
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
                        onClick={handleSaveClick}
                        className="px-4 py-2 text-sm font-medium text-white bg-sky-600 rounded-lg hover:bg-sky-700"
                    >
                        Lưu Thay Đổi
                    </button>
                </div>
            </div>
        </div>
    );
}; 