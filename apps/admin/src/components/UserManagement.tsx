import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Select, Tag, Space, Modal, message, InputNumber, Tooltip } from 'antd';
import { SearchOutlined, UserOutlined, EditOutlined, StopOutlined, CheckOutlined } from '@ant-design/icons';
import { fetchUsers, fetchUserStats, updateUserCredits, updateUserStatus } from '../services/keyService';

const { Option } = Select;
const { confirm } = Modal;

interface User {
  _id: string;
  username: string;
  email: string;
  remainingCredits?: number;
  isActive?: boolean;
  subscriptionType?: string;
  createdAt: string;
  lastLoginAt?: string;
}

interface UserStats {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  newUsersThisMonth: number;
  recentUsers: User[];
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [userStats, setUserStats] = useState<UserStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [newCredits, setNewCredits] = useState(0);

  const loadUsers = async (page = 1, search = searchText, status = statusFilter) => {
    setLoading(true);
    try {
      const response = await fetchUsers(page, pagination.pageSize, search, status);
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
  }, []);

  const handleSearch = (value: string) => {
    setSearchText(value);
    loadUsers(1, value, statusFilter);
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    loadUsers(1, searchText, value);
  };

  const handleTableChange = (paginationInfo: any) => {
    loadUsers(paginationInfo.current);
  };

  const handleEditCredits = (user: User) => {
    setEditingUser(user);
    setNewCredits(user.remainingCredits);
    setIsModalVisible(true);
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
      render: (status: string) => {
        const subStatus = status || 'free';
        return (
          <Tag color={subStatus === 'lifetime' ? 'gold' : subStatus === 'monthly' ? 'blue' : 'default'}>
            {subStatus}
          </Tag>
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
          <Tooltip title="Chỉnh sửa credits">
            <Button
              type="primary"
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEditCredits(record)}
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
        <Space size="middle">
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
          >
            <Option value="all">Tất cả</Option>
            <Option value="active">Hoạt động</Option>
            <Option value="inactive">Vô hiệu</Option>
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
            <strong>Credits hiện tại:</strong> {editingUser?.remainingCredits}
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
      </Modal>
    </div>
  );
};

export default UserManagement;