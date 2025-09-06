import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Select, Tag, Space, Modal, message, InputNumber, Tooltip } from 'antd';
import { SearchOutlined, UserOutlined, EditOutlined, StopOutlined, CheckOutlined, CrownOutlined, GlobalOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { fetchUsers, fetchUserStats, updateUserCredits, updateUserStatus, updateUserSubscription } from '../services/keyService';

const { Option } = Select;
const { confirm } = Modal;

interface User {
  _id: string;
  username: string;
  email: string;
  remainingCredits?: number;
  isActive?: boolean;
  subscriptionType?: string;
  subscriptionExpiresAt?: string;
  bonusDailyLimit?: number;
  createdAt: string;
  lastLoginAt?: string;
  sessionInfo?: {
    isOnline: boolean;
    lastActivity: string | null;
    loginAt: string | null;
    sessionDuration: number; // in minutes
    ipAddress: string | null;
    userAgent: string | null;
  };
}

interface UserStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  newUsersThisMonth: number;
  recentUsers: User[];
}

interface Package {
  _id: string;
  planId: string;
  name: string;
  durationType: 'days' | 'months';
  durationValue: number;
  isActive: boolean;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [onlineStatusFilter, setOnlineStatusFilter] = useState('all');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newCredits, setNewCredits] = useState(0);
  const [isSubscriptionModalVisible, setIsSubscriptionModalVisible] = useState(false);
  const [newSubscriptionType, setNewSubscriptionType] = useState('free');
  const [newSubscriptionExpiry, setNewSubscriptionExpiry] = useState('');
  const [manualTrialDays, setManualTrialDays] = useState(3);

  // Bonus Daily Limit Management
  const [isBonusLimitModalVisible, setIsBonusLimitModalVisible] = useState(false);
  const [newBonusLimit, setNewBonusLimit] = useState(0);

  const loadUsers = async (page = 1, search = searchText, status = statusFilter, onlineStatus = onlineStatusFilter) => {
    setLoading(true);
    try {
      const response = await fetchUsers(page, pagination.pageSize, search, status, onlineStatus);
      setUsers(response.users || []);
      setPagination(prev => ({
        ...prev,
        current: response.pagination?.current || 1,
        total: response.pagination?.total || 0,
      }));
    } catch (error) {
      console.error('Failed to load users:', error);
      message.error('Không thể tải danh sách users');
    } finally {
      setLoading(false);
    }
  };

  const loadUserStats = async () => {
    try {
      const stats = await fetchUserStats();
      setUserStats(stats);
    } catch (error) {
      console.error('Failed to load user stats:', error);
    }
  };

  useEffect(() => {
    loadUsers();
    loadUserStats();
    loadPackages();
    
    // Auto-refresh mỗi 30 giây để cập nhật trạng thái online
    const interval = setInterval(() => {
      loadUsers(pagination.current, searchText, statusFilter, onlineStatusFilter);
    }, 30000);
    
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadPackages = async () => {
    try {
      const response = await fetch('https://aistory-backend.onrender.com/api/admin/packages');
      const data = await response.json();
      if (data.success) {
        setPackages(data.packages.filter((pkg: Package) => pkg.isActive));
      }
    } catch (error) {
      console.error('Error loading packages:', error);
    }
  };

  const handleSearch = (value: string) => {
    setSearchText(value);
    loadUsers(1, value, statusFilter, onlineStatusFilter);
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    loadUsers(1, searchText, value, onlineStatusFilter);
  };

  const handleOnlineStatusFilter = (value: string) => {
    setOnlineStatusFilter(value);
    loadUsers(1, searchText, statusFilter, value);
  };

  const handleTableChange = (paginationInfo: any) => {
    loadUsers(paginationInfo.current);
  };

  const handleEditCredits = (user: User) => {
    setEditingUser(user);
    setNewCredits(user.remainingCredits || 0);
    setIsModalVisible(true);
  };

  const handleEditSubscription = (user: User) => {
    setEditingUser(user);
    setNewSubscriptionType(user.subscriptionType || 'free');
    
    // Set expiry date - if lifetime, set far future date, if monthly, set 1 month from now
    if (user.subscriptionType === 'lifetime') {
      setNewSubscriptionExpiry('2099-12-31');
    } else if (user.subscriptionType === 'monthly' && user.subscriptionExpiresAt) {
      setNewSubscriptionExpiry(user.subscriptionExpiresAt.split('T')[0]);
    } else {
      // Default to 1 month from now for new monthly subscriptions
      const nextMonth = new Date();
      nextMonth.setMonth(nextMonth.getMonth() + 1);
      setNewSubscriptionExpiry(nextMonth.toISOString().split('T')[0]);
    }
    
    setIsSubscriptionModalVisible(true);
  };

  const handleEditBonusLimit = (user: User) => {
    setEditingUser(user);
    setNewBonusLimit(user.bonusDailyLimit || 0);
    setIsBonusLimitModalVisible(true);
  };

  const handleUpdateBonusLimit = async () => {
    if (!editingUser) return;

    try {
      const response = await fetch(`/api/admin/users/${editingUser._id}/bonus-limit`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ bonusDailyLimit: newBonusLimit }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      message.success(`Cập nhật bonus limit thành công! (+${newBonusLimit})`);
      setIsBonusLimitModalVisible(false);
      setEditingUser(null);
      loadUsers(pagination.current);
    } catch (error) {
      message.error('Không thể cập nhật bonus limit');
      console.error('Error updating bonus limit:', error);
    }
  };

  const handleUpdateCredits = async () => {
    if (!editingUser) return;

    try {
      await updateUserCredits(editingUser._id, newCredits);
      message.success('Cập nhật credits thành công!');
      setIsModalVisible(false);
      setEditingUser(null);
      loadUsers(pagination.current);
    } catch (error) {
      message.error('Không thể cập nhật credits');
    }
  };

  const handleUpdateSubscription = async () => {
    if (!editingUser) return;

    try {
      let expiryDate: string;
      let subscriptionTypeToSave: string;
      
      if (newSubscriptionType === 'free') {
        expiryDate = new Date().toISOString(); // Set to now for free accounts
        subscriptionTypeToSave = 'free';
      } else if (newSubscriptionType === 'manual_trial') {
        // Manual trial - save as trial_Xdays format
        subscriptionTypeToSave = `trial_${manualTrialDays}days`;
        const now = new Date();
        now.setDate(now.getDate() + manualTrialDays);
        expiryDate = now.toISOString();
      } else {
        // Regular package
        subscriptionTypeToSave = newSubscriptionType;
        const selectedPackage = packages.find(pkg => pkg.planId === newSubscriptionType);
        if (selectedPackage && selectedPackage.durationValue >= 999) {
          // Lifetime package
          expiryDate = new Date('2099-12-31').toISOString();
        } else {
          // Use the manually set expiry date
          expiryDate = new Date(newSubscriptionExpiry).toISOString();
        }
      }

      await updateUserSubscription(editingUser._id, subscriptionTypeToSave, expiryDate);
      message.success(`Cập nhật subscription thành công! ${newSubscriptionType === 'manual_trial' ? `Khách hàng được dùng thử ${manualTrialDays} ngày.` : ''}`);
      setIsSubscriptionModalVisible(false);
      setEditingUser(null);
      loadUsers(pagination.current);
    } catch (error) {
      message.error('Không thể cập nhật subscription');
    }
  };

  const handleToggleStatus = (user: User) => {
    const action = user.isActive ? 'vô hiệu hóa' : 'kích hoạt';
    confirm({
      title: `Xác nhận ${action} user`,
      content: `Bạn có chắc muốn ${action} user "${user.username}"?`,
      onOk: async () => {
        try {
          await updateUserStatus(user._id, !user.isActive);
          message.success(`${action.charAt(0).toUpperCase() + action.slice(1)} user thành công!`);
          loadUsers(pagination.current);
        } catch (error) {
          message.error(`Không thể ${action} user`);
        }
      },
    });
  };

  const columns = [
    {
      title: 'Username',
      dataIndex: 'username',
      key: 'username',
      render: (text: string) => (
        <Space>
          <UserOutlined />
          <strong>{text}</strong>
        </Space>
      ),
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: 'Credits',
      dataIndex: 'remainingCredits',
      key: 'remainingCredits',
      render: (credits: number) => {
        const creditValue = credits || 0;
        return (
          <Tag color={creditValue > 100 ? 'green' : creditValue > 10 ? 'orange' : 'red'}>
            {creditValue.toLocaleString()}
          </Tag>
        );
      },
    },
    {
      title: 'Bonus Limit',
      dataIndex: 'bonusDailyLimit',
      key: 'bonusDailyLimit',
      render: (bonusLimit: number = 0) => (
        <Tag color={bonusLimit > 0 ? 'blue' : 'default'}>
          +{bonusLimit}
        </Tag>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => {
        const status = isActive !== false; // Default to true if undefined
        return (
          <Tag color={status ? 'green' : 'red'}>
            {status ? 'Hoạt động' : 'Vô hiệu'}
          </Tag>
        );
      },
    },
    {
      title: 'Subscription',
      dataIndex: 'subscriptionType',
      key: 'subscriptionType',
      render: (status: string, record: User) => {
        const subStatus = status || 'free';
        const isExpired = record.subscriptionExpiresAt && new Date(record.subscriptionExpiresAt) < new Date();
        
        let color = 'default';
        let text = subStatus;
        
        if (subStatus === 'free') {
          text = 'Free';
          color = 'default';
        } else if (subStatus.startsWith('trial_') && subStatus.endsWith('days')) {
          // Manual trial format: trial_5days
          const days = subStatus.match(/trial_(\d+)days/)?.[1];
          text = `🎯 Dùng Thử ${days} Ngày`;
          color = isExpired ? 'red' : 'cyan';
          if (isExpired) {
            text += ' (Hết hạn)';
          }
        } else {
          // Find package info
          const packageInfo = packages.find(pkg => pkg.planId === subStatus);
          if (packageInfo) {
            text = packageInfo.name;
            if (packageInfo.durationType === 'days') {
              color = isExpired ? 'red' : 'cyan';
            } else if (packageInfo.durationValue >= 999) {
              color = 'gold'; // Lifetime
            } else {
              color = isExpired ? 'red' : 'blue'; // Monthly
            }
          } else {
            // Fallback for old subscription types
            if (subStatus === 'lifetime' || subStatus.includes('lifetime')) {
              color = 'gold';
              text = 'Lifetime';
            } else if (subStatus === 'monthly' || subStatus.includes('monthly')) {
              color = isExpired ? 'red' : 'blue';
              text = 'Monthly';
            }
          }
          
          if (isExpired) {
            text += ' (Hết hạn)';
          }
        }
        
        return (
          <div>
            <Tag color={color}>{text}</Tag>
            {record.subscriptionExpiresAt && subStatus !== 'free' && (
              <div style={{ fontSize: '12px', color: '#666' }}>
                Hết hạn: {new Date(record.subscriptionExpiresAt).toLocaleDateString('vi-VN')}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Online Status',
      key: 'onlineStatus',
      render: (_, record: User) => {
        const sessionInfo = record.sessionInfo;
        if (!sessionInfo) {
          return <Tag color="default">Không có data</Tag>;
        }
        
        return (
          <div>
            <Tag 
              color={sessionInfo.isOnline ? 'green' : 'default'}
              icon={<GlobalOutlined />}
            >
              {sessionInfo.isOnline ? 'Online' : 'Offline'}
            </Tag>
            {sessionInfo.isOnline && sessionInfo.sessionDuration > 0 && (
              <div style={{ fontSize: '12px', color: '#666', marginTop: 2 }}>
                <ClockCircleOutlined /> {sessionInfo.sessionDuration} phút
              </div>
            )}
            {sessionInfo.lastActivity && (
              <div style={{ fontSize: '12px', color: '#999', marginTop: 2 }}>
                Hoạt động: {new Date(sessionInfo.lastActivity).toLocaleString('vi-VN')}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString('vi-VN'),
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_, record: User) => (
        <Space size="middle">
          <Tooltip title="Chỉnh sửa subscription">
            <Button
              type="primary"
              icon={<CrownOutlined />}
              size="small"
              onClick={() => handleEditSubscription(record)}
            />
          </Tooltip>
          <Tooltip title="Chỉnh sửa credits">
            <Button
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEditCredits(record)}
            />
          </Tooltip>
          <Tooltip title="Chỉnh sửa Bonus Limit">
            <Button
              type="dashed"
              icon={<GlobalOutlined />}
              size="small"
              onClick={() => handleEditBonusLimit(record)}
            />
          </Tooltip>
          <Tooltip title={record.isActive ? 'Vô hiệu hóa' : 'Kích hoạt'}>
            <Button
              type={record.isActive ? 'default' : 'primary'}
              icon={record.isActive ? <StopOutlined /> : <CheckOutlined />}
              size="small"
              onClick={() => handleToggleStatus(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="user-management">
      <div className="page-header">
        <h2>Quản lý Users</h2>
      </div>

      {/* Stats Cards */}
      {userStats && (
        <div className="stats-row" style={{ marginBottom: 24 }}>
          <div className="stats-card">
            <h3>Tổng Users</h3>
            <p className="stats-number">{userStats.totalUsers}</p>
          </div>
          <div className="stats-card">
            <h3>Users Hoạt động</h3>
            <p className="stats-number" style={{ color: '#52c41a' }}>
              {userStats.activeUsers}
            </p>
          </div>
          <div className="stats-card">
            <h3>Users Vô hiệu</h3>
            <p className="stats-number" style={{ color: '#ff4d4f' }}>
              {userStats.inactiveUsers}
            </p>
          </div>
          <div className="stats-card">
            <h3>Đăng ký tháng này</h3>
            <p className="stats-number" style={{ color: '#1890ff' }}>
              {userStats.newUsersThisMonth}
            </p>
          </div>
        </div>
      )}

      {/* Search and Filters */}
      <div className="filters-row" style={{ marginBottom: 16 }}>
        <Space size="middle" wrap>
          <Input.Search
            placeholder="Tìm kiếm username hoặc email..."
            allowClear
            style={{ width: 300 }}
            onSearch={handleSearch}
            prefix={<SearchOutlined />}
          />
          <Select
            value={statusFilter}
            style={{ width: 150 }}
            onChange={handleStatusFilter}
            placeholder="Trạng thái"
          >
            <Option value="all">🟢 Tất cả</Option>
            <Option value="active">✅ Hoạt động</Option>
            <Option value="inactive">❌ Vô hiệu</Option>
          </Select>
          <Select
            value={onlineStatusFilter}
            style={{ width: 150 }}
            onChange={handleOnlineStatusFilter}
            placeholder="Online Status"
          >
            <Option value="all">🌐 Tất cả</Option>
            <Option value="online">🟢 Online</Option>
            <Option value="offline">⚪ Offline</Option>
          </Select>
          <Button onClick={() => loadUsers(1)}>
            Làm mới
          </Button>
        </Space>
      </div>

      {/* Users Table */}
      <Table
        columns={columns}
        dataSource={users}
        rowKey="_id"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showQuickJumper: true,
          showTotal: (total, range) =>
            `${range[0]}-${range[1]} của ${total} users`,
        }}
        onChange={handleTableChange}
        scroll={{ x: 800 }}
      />

      {/* Edit Subscription Modal */}
      <Modal
        title={`Quản lý Subscription - ${editingUser?.username}`}
        visible={isSubscriptionModalVisible}
        onOk={handleUpdateSubscription}
        onCancel={() => {
          setIsSubscriptionModalVisible(false);
          setEditingUser(null);
        }}
        okText="Cập nhật"
        cancelText="Hủy"
        width={600}
      >
        <div style={{ marginBottom: 16 }}>
          <p>
            <strong>User:</strong> {editingUser?.username} ({editingUser?.email})
          </p>
          <p>
            <strong>Subscription hiện tại:</strong> {
              (() => {
                const currentSub = editingUser?.subscriptionType || 'free';
                if (currentSub === 'free') return 'Free';
                if (currentSub.startsWith('trial_') && currentSub.endsWith('days')) {
                  const days = currentSub.match(/trial_(\d+)days/)?.[1];
                  return `🎯 Dùng Thử ${days} Ngày`;
                }
                const packageInfo = packages.find(pkg => pkg.planId === currentSub);
                return packageInfo ? packageInfo.name : currentSub;
              })()
            }
          </p>
          {editingUser?.subscriptionExpiresAt && (
            <p>
              <strong>Hết hạn:</strong> {new Date(editingUser.subscriptionExpiresAt).toLocaleDateString('vi-VN')}
            </p>
          )}
        </div>
        
        <div style={{ marginBottom: 16 }}>
          <label>Loại subscription:</label>
          <Select
            value={newSubscriptionType}
            onChange={(value) => {
              setNewSubscriptionType(value);
              // Auto-set expiry date based on selection
              if (value === 'manual_trial') {
                // Manual trial - calculate from current date + manual days
                const now = new Date();
                now.setDate(now.getDate() + manualTrialDays);
                setNewSubscriptionExpiry(now.toISOString().split('T')[0]);
              } else if (value !== 'free') {
                const selectedPackage = packages.find(pkg => pkg.planId === value);
                if (selectedPackage) {
                  const now = new Date();
                  if (selectedPackage.durationType === 'days') {
                    now.setDate(now.getDate() + selectedPackage.durationValue);
                  } else if (selectedPackage.durationType === 'months') {
                    if (selectedPackage.durationValue >= 999) {
                      // Lifetime package
                      now.setFullYear(2099);
                    } else {
                      now.setMonth(now.getMonth() + selectedPackage.durationValue);
                    }
                  }
                  setNewSubscriptionExpiry(now.toISOString().split('T')[0]);
                }
              }
            }}
            style={{ width: '100%', marginTop: 8 }}
          >
            <Option value="free">🆓 Free (Miễn phí)</Option>
            <Option value="manual_trial">🎯 Dùng Thử Tùy Chỉnh (Theo Ngày)</Option>
            <hr style={{ margin: '8px 0', borderColor: '#d9d9d9' }} />
            {packages.map(pkg => (
              <Option key={pkg.planId} value={pkg.planId}>
                {pkg.durationType === 'days' ? '⏰' : pkg.durationValue >= 999 ? '👑' : '📅'} {pkg.name} ({pkg.durationValue} {pkg.durationType === 'days' ? 'ngày' : 'tháng'})
              </Option>
            ))}
          </Select>
        </div>

        {/* Manual Trial Days Input */}
        {newSubscriptionType === 'manual_trial' && (
          <div style={{ marginBottom: 16, padding: 12, backgroundColor: '#e6f7ff', borderRadius: 4, border: '1px solid #91d5ff' }}>
            <label>Số ngày dùng thử:</label>
            <InputNumber
              value={manualTrialDays}
              onChange={(value) => {
                setManualTrialDays(value || 1);
                // Auto-update expiry date when days change
                const now = new Date();
                now.setDate(now.getDate() + (value || 1));
                setNewSubscriptionExpiry(now.toISOString().split('T')[0]);
              }}
              min={1}
              max={365}
              style={{ width: '100%', marginTop: 8 }}
              placeholder="Nhập số ngày (1-365)"
            />
            <div style={{ fontSize: '12px', color: '#1890ff', marginTop: 4 }}>
              💡 Khách hàng sẽ được dùng thử tất cả tính năng trong {manualTrialDays} ngày
              <br />
              📅 Hết hạn: {new Date(Date.now() + manualTrialDays * 24 * 60 * 60 * 1000).toLocaleDateString('vi-VN')}
            </div>
          </div>
        )}

        {newSubscriptionType !== 'free' && (
          <div>
            <label>Ngày hết hạn:</label>
            <Input
              type="date"
              value={newSubscriptionExpiry}
              onChange={(e) => setNewSubscriptionExpiry(e.target.value)}
              style={{ width: '100%', marginTop: 8 }}
              disabled={newSubscriptionType === 'lifetime'}
            />
            {newSubscriptionType === 'lifetime' && (
              <p style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
                Lifetime subscription tự động set năm 2099
              </p>
            )}
          </div>
        )}
      </Modal>

      {/* Edit Credits Modal */}
      <Modal
        title={`Chỉnh sửa Credits - ${editingUser?.username}`}
        visible={isModalVisible}
        onOk={handleUpdateCredits}
        onCancel={() => {
          setIsModalVisible(false);
          setEditingUser(null);
        }}
        okText="Cập nhật"
        cancelText="Hủy"
      >
        <div style={{ marginBottom: 16 }}>
          <p>
            <strong>User:</strong> {editingUser?.username} ({editingUser?.email})
          </p>
          <p>
            <strong>Credits hiện tại:</strong> {editingUser?.remainingCredits || 0}
          </p>
        </div>
        <div>
          <label>Credits mới:</label>
          <InputNumber
            value={newCredits}
            onChange={(value) => setNewCredits(value || 0)}
            min={0}
            style={{ width: '100%', marginTop: 8 }}
            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          />
        </div>
        <p style={{ fontSize: '12px', color: '#666', marginTop: 8 }}>
          Lưu ý: Trong phiên bản mới, credits chỉ để hiển thị. Người dùng sử dụng subscription theo tháng.
        </p>
      </Modal>

      {/* Edit Bonus Daily Limit Modal */}
      <Modal
        title={`Cộng thêm Bonus Limit - ${editingUser?.username}`}
        visible={isBonusLimitModalVisible}
        onOk={handleUpdateBonusLimit}
        onCancel={() => {
          setIsBonusLimitModalVisible(false);
          setEditingUser(null);
        }}
        okText="Cập nhật"
        cancelText="Hủy"
      >
        <div>
          <p><strong>Global Limit:</strong> 555 lượt/ngày (từ webadmin)</p>
          <p><strong>Current Bonus:</strong> +{editingUser?.bonusDailyLimit || 0}</p>
          <p><strong>Current Total:</strong> {555 + (editingUser?.bonusDailyLimit || 0)} lượt/ngày</p>
        </div>
        <div style={{ marginTop: 16 }}>
          <label>Bonus Limit mới:</label>
          <InputNumber
            value={newBonusLimit}
            onChange={(value) => setNewBonusLimit(value || 0)}
            min={0}
            max={10000}
            style={{ width: '100%', marginTop: 8 }}
            addonBefore="+"
            formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
          />
        </div>
        <div style={{ marginTop: 8, padding: '8px', background: '#f0f0f0', borderRadius: '4px' }}>
          <strong>New Total: </strong>
          <span style={{ color: '#1890ff' }}>
            555 + {newBonusLimit} = {555 + newBonusLimit} lượt/ngày
          </span>
        </div>
        <p style={{ fontSize: '12px', color: '#666', marginTop: 8 }}>
          Bonus limit sẽ được cộng thêm vào global limit (555) để tạo thành total limit cho user này.
        </p>
      </Modal>
    </div>
  );
};

export default UserManagement;