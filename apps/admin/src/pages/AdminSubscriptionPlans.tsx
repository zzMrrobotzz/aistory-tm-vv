import React, { useState, useEffect } from 'react';
import { Gift, DollarSign, Edit, Trash2, PlusCircle } from 'lucide-react';
import { Card, Button, message, Modal, Form, Input, InputNumber, Switch, Popconfirm, Space, Spin, Typography } from 'antd';
import { fetchPackages, createPackage, updatePackage, deletePackage } from '../services/keyService';

const { Title, Text } = Typography;

interface SubscriptionPlan {
  _id: string;
  name: string;
  price: number;
  durationMonths: number;
  description?: string;
  isActive: boolean;
  isPopular: boolean;
  planId?: string;
}

const AdminSubscriptionPlans: React.FC = () => {
    const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [editingPlan, setEditingPlan] = useState<SubscriptionPlan | null>(null);
    const [form] = Form.useForm();

    const loadPlans = async () => {
        setLoading(true);
        try {
            const data = await fetchPackages();
            if (Array.isArray(data)) {
                setPlans(data);
            } else if (data.success) {
                setPlans(data.packages || []);
            } else {
                setPlans([]);
            }
        } catch (error: any) {
            console.error('Error loading plans:', error);
            message.error('Không thể tải danh sách gói subscription');
            setPlans([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPlans();
    }, []);

    const handleAddNew = () => {
        setEditingPlan(null);
        form.resetFields();
        setIsModalVisible(true);
    };

    const handleEdit = (plan: SubscriptionPlan) => {
        setEditingPlan(plan);
        form.setFieldsValue(plan);
        setIsModalVisible(true);
    };

    const handleDelete = async (planId: string) => {
        try {
            const data = await deletePackage(planId);
            if (data.success) {
                message.success('Xóa gói subscription thành công!');
                loadPlans();
            } else {
                message.error(data.error || 'Xóa gói subscription thất bại');
            }
        } catch (error: any) {
            console.error('Error deleting plan:', error);
            message.error('Xóa gói subscription thất bại');
        }
    };

    const handleFormSubmit = async () => {
        try {
            const values = await form.validateFields();
            const isEdit = editingPlan?._id;
            
            let data;
            if (isEdit) {
                data = await updatePackage(editingPlan._id, values);
            } else {
                data = await createPackage(values);
            }
            
            if (data.success) {
                message.success(isEdit ? 'Cập nhật gói subscription thành công!' : 'Tạo gói subscription mới thành công!');
                setIsModalVisible(false);
                loadPlans();
            } else {
                message.error(data.error || 'Thao tác thất bại');
            }
        } catch (error: any) {
            console.error('Error saving plan:', error);
            message.error('Thao tác thất bại');
        }
    };

    if (loading) {
        return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400 }}>
                <Spin size="large" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold text-gray-800">Quản Lý Gói Cước</h1>
            <div className="flex justify-end">
                <button 
                    onClick={handleAddNew}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700"
                >
                    <PlusCircle className="h-5 w-5 mr-2" />
                    Thêm Gói Mới
                </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {plans.map(plan => (
                    <div key={plan._id} className={`bg-white rounded-xl shadow-lg p-6 flex flex-col justify-between transition-all duration-300 ${!plan.isActive ? 'opacity-50 bg-gray-100' : 'hover:shadow-xl hover:-translate-y-1'}`}>
                        <div>
                            {plan.isPopular && (
                                <div className="text-xs font-bold text-purple-600 bg-purple-100 px-3 py-1 rounded-full inline-block mb-3">Phổ biến</div>
                            )}
                            <h3 className="text-xl font-bold text-gray-800">{plan.name}</h3>
                            <p className="text-3xl font-extrabold text-blue-600 my-3">
                                {plan.price.toLocaleString('vi-VN')}
                                <span className="text-lg font-medium text-gray-500"> VNĐ</span>
                            </p>
                            <p className="text-gray-600 text-sm mb-4 h-12">{plan.description || 'Không có mô tả'}</p>
                            <div className="border-t border-gray-200 pt-4 text-sm space-y-2">
                                <div className="flex justify-between">
                                    <span className="text-gray-500">Mã gói (ID):</span>
                                    <span className="font-semibold text-gray-700">{plan.planId || plan._id}</span>
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
                            <button 
                                onClick={() => handleEdit(plan)}
                                className="w-full flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200"
                            >
                                <Edit className="h-4 w-4 mr-2"/> Sửa
                            </button>
                            <Popconfirm
                                title="Bạn có chắc muốn xóa gói này?"
                                onConfirm={() => handleDelete(plan._id)}
                                okText="Xóa"
                                cancelText="Hủy"
                            >
                                <button className="px-4 py-2 bg-red-100 text-red-700 font-semibold rounded-lg hover:bg-red-200">
                                    <Trash2 className="h-4 w-4"/>
                                </button>
                            </Popconfirm>
                        </div>
                    </div>
                ))}
            </div>
            
            {/* Create/Edit Modal */}
            <Modal
                title={editingPlan ? 'Sửa Gói Subscription' : 'Tạo Gói Subscription Mới'}
                open={isModalVisible}
                onOk={handleFormSubmit}
                onCancel={() => setIsModalVisible(false)}
                destroyOnClose
                okText="Lưu"
                cancelText="Hủy"
                width={600}
            >
                <Form 
                    form={form} 
                    layout="vertical" 
                    initialValues={{ 
                        isPopular: false, 
                        isActive: true,
                        durationMonths: 1 
                    }}
                >
                    <Form.Item name="name" label="Tên Gói" rules={[{ required: true, message: 'Vui lòng nhập tên gói' }]}>
                        <Input placeholder="VD: Monthly, Lifetime" />
                    </Form.Item>
                    
                    <Form.Item name="planId" label="Plan ID" rules={[{ required: true, message: 'Vui lòng nhập plan ID' }]}>
                        <Input placeholder="VD: monthly_299k, lifetime_2990k" />
                    </Form.Item>
                    
                    <Form.Item name="price" label="Giá (VNĐ)" rules={[{ required: true, message: 'Vui lòng nhập giá' }]}>
                        <InputNumber 
                            min={0} 
                            style={{ width: '100%' }}
                            formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                            parser={value => value!.replace(/\$\s?|(,*)/g, '')}
                        />
                    </Form.Item>
                    
                    <Form.Item name="durationMonths" label="Thời hạn (tháng)" rules={[{ required: true, message: 'Vui lòng nhập thời hạn' }]}>
                        <InputNumber 
                            min={1} 
                            style={{ width: '100%' }}
                            placeholder="1 = Monthly, 999 = Lifetime"
                        />
                    </Form.Item>
                    
                    <Form.Item name="description" label="Mô tả">
                        <Input.TextArea 
                            rows={3} 
                            placeholder="Mô tả chi tiết về gói subscription..." 
                        />
                    </Form.Item>
                    
                    <Space>
                        <Form.Item name="isPopular" label="Gói phổ biến" valuePropName="checked">
                            <Switch />
                        </Form.Item>
                        
                        <Form.Item name="isActive" label="Kích hoạt gói" valuePropName="checked">
                            <Switch />
                        </Form.Item>
                    </Space>
                </Form>
            </Modal>
        </div>
    );
};

export default AdminSubscriptionPlans; 