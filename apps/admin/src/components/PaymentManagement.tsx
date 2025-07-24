import React, { useState, useEffect } from 'react';
import { Table, Button, Input, Select, Tag, Space, Card, Row, Col, Statistic, message, Modal, Tooltip, DatePicker } from 'antd';
import { SearchOutlined, DollarOutlined, CreditCardOutlined, CheckCircleOutlined, CloseCircleOutlined, ClockCircleOutlined, BarChartOutlined, ReloadOutlined, EyeOutlined, UndoOutlined, EditOutlined } from '@ant-design/icons';
import { 
  fetchPaymentStats, 
  fetchPayments, 
  fetchPaymentDetails,
  completePayment,
  refundPayment,
  formatCurrency,
  getStatusColor,
  getStatusText,
  getPaymentMethodText
} from '../services/paymentService';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { confirm } = Modal;

interface Payment {
  _id: string;
  userId?: string;
  userKey?: string;
  planId?: string;
  creditAmount?: number;
  price: number;
  status: 'pending' | 'completed' | 'failed' | 'expired' | 'refunded';
  paymentMethod: string;
  transactionId?: string;
  createdAt: string;
  completedAt?: string;
  expiredAt?: string;
  paymentData?: {
    payUrl?: string;
    qrCode?: string;
    bankAccount?: string;
    amount?: number;
    transferContent?: string;
    orderCode?: number;
    payosPaymentLinkId?: string;
  };
  metadata?: {
    ip?: string;
    userAgent?: string;
    referer?: string;
    userId?: string;
    planId?: string;
  };
}

interface PaymentStats {
  totalRevenue: number;
  totalPayments: number;
  completedPayments: number;
  pendingPayments: number;
  failedPayments: number;
  expiredPayments: number;
  revenueThisMonth: number;
  paymentsThisMonth: number;
  recentPayments: Payment[];
  topPlanIds: Array<{ planId: string; count: number; revenue: number }>;
}

const PaymentManagement: React.FC = () => {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentStats, setPaymentStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [dateRange, setDateRange] = useState<[any, any] | null>(null);
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);

  const loadPayments = async (page = 1, search = searchText, status = statusFilter, paymentMethod = paymentMethodFilter, startDate?: string, endDate?: string) => {
    setLoading(true);
    try {
      const response = await fetchPayments(page, pagination.pageSize, search, status, paymentMethod, startDate, endDate);
      setPayments(response.payments || []);
      setPagination(prev => ({
        ...prev,
        current: response.pagination?.current || 1,
        total: response.pagination?.total || 0,
      }));
    } catch (error) {
      console.error('Failed to load payments:', error);
      message.error('Không thể tải danh sách payments');
    } finally {
      setLoading(false);
    }
  };

  const loadPaymentStats = async () => {
    setStatsLoading(true);
    try {
      const stats = await fetchPaymentStats();
      setPaymentStats(stats);
    } catch (error) {
      console.error('Failed to load payment stats:', error);
      message.error('Không thể tải thống kê payments');
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    loadPayments();
    loadPaymentStats();
  }, []);

  const handleSearch = (value: string) => {
    setSearchText(value);
    const [startDate, endDate] = dateRange || [];
    loadPayments(1, value, statusFilter, paymentMethodFilter, 
      startDate?.format('YYYY-MM-DD'), endDate?.format('YYYY-MM-DD'));
  };

  const handleStatusFilter = (value: string) => {
    setStatusFilter(value);
    const [startDate, endDate] = dateRange || [];
    loadPayments(1, searchText, value, paymentMethodFilter,
      startDate?.format('YYYY-MM-DD'), endDate?.format('YYYY-MM-DD'));
  };

  const handlePaymentMethodFilter = (value: string) => {
    setPaymentMethodFilter(value);
    const [startDate, endDate] = dateRange || [];
    loadPayments(1, searchText, statusFilter, value,
      startDate?.format('YYYY-MM-DD'), endDate?.format('YYYY-MM-DD'));
  };

  const handleDateRangeChange = (dates: any) => {
    setDateRange(dates);
    const [startDate, endDate] = dates || [];
    loadPayments(1, searchText, statusFilter, paymentMethodFilter,
      startDate?.format('YYYY-MM-DD'), endDate?.format('YYYY-MM-DD'));
  };

  const handleTableChange = (paginationInfo: any) => {
    const [startDate, endDate] = dateRange || [];
    loadPayments(paginationInfo.current, searchText, statusFilter, paymentMethodFilter,
      startDate?.format('YYYY-MM-DD'), endDate?.format('YYYY-MM-DD'));
  };

  const handleViewDetails = async (payment: Payment) => {
    try {
      const details = await fetchPaymentDetails(payment._id);
      setSelectedPayment(details);
      setIsDetailModalVisible(true);
    } catch (error) {
      message.error('Không thể tải chi tiết payment');
    }
  };

  // Handler for completing payment manually
  const handleCompletePayment = (payment: Payment) => {
    confirm({
      title: 'Xác nhận hoàn thành thanh toán',
      content: (
        <div>
          <p>Bạn có chắc chắn muốn đánh dấu payment này là hoàn thành?</p>
          <p><strong>Payment ID:</strong> {payment._id}</p>
          <p><strong>Số tiền:</strong> {formatCurrency(payment.price)}</p>
          <p><strong>Plan:</strong> {payment.planId || `${payment.creditAmount} credits`}</p>
        </div>
      ),
      onOk: async () => {
        try {
          await completePayment(payment._id);
          message.success('Payment đã được hoàn thành!');
          loadPayments();
          loadPaymentStats();
        } catch (error: any) {
          message.error(error.message || 'Không thể hoàn thành payment');
        }
      },
    });
  };

  // Handler for refunding payment
  const handleRefundPayment = (payment: Payment) => {
    confirm({
      title: 'Xác nhận hoàn tiền',
      content: (
        <div>
          <p>Bạn có chắc chắn muốn hoàn tiền cho payment này?</p>
          <p><strong>Payment ID:</strong> {payment._id}</p>
          <p><strong>Số tiền:</strong> {formatCurrency(payment.price)}</p>
          <p><strong>Plan:</strong> {payment.planId || `${payment.creditAmount} credits`}</p>
          <p style={{ color: 'red', marginTop: 8 }}>⚠️ Hành động này không thể hoàn tác!</p>
        </div>
      ),
      onOk: async () => {
        try {
          await refundPayment(payment._id, 'Admin manual refund');
          message.success('Payment đã được hoàn tiền!');
          loadPayments();
          loadPaymentStats();
        } catch (error: any) {
          message.error(error.message || 'Không thể hoàn tiền payment');
        }
      },
    });
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: '_id',
      key: '_id',
      width: 100,
      render: (text: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>
          {text.slice(-8)}
        </span>
      ),
    },
    {
      title: 'User/Plan',
      key: 'userInfo',
      width: 150,
      render: (_, record: Payment) => (
        <div>
          <div style={{ fontWeight: 'bold', fontSize: '12px' }}>
            {record.userKey || record.userId?.slice(-8) || 'N/A'}
          </div>
          <div style={{ fontSize: '11px', color: '#666' }}>
            {record.planId || `${record.creditAmount} credits`}
          </div>
        </div>
      ),
    },
    {
      title: 'Số tiền',
      dataIndex: 'price',
      key: 'price',
      width: 120,
      render: (price: number) => (
        <Tag color="blue" style={{ fontWeight: 'bold' }}>
          {formatCurrency(price)}
        </Tag>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status: string) => (
        <Tag color={getStatusColor(status)} icon={
          status === 'completed' ? <CheckCircleOutlined /> :
          status === 'pending' ? <ClockCircleOutlined /> :
          status === 'failed' ? <CloseCircleOutlined /> : undefined
        }>
          {getStatusText(status)}
        </Tag>
      ),
    },
    {
      title: 'Phương thức',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      width: 120,
      render: (method: string) => (
        <span style={{ fontSize: '12px' }}>
          {getPaymentMethodText(method)}
        </span>
      ),
    },
    {
      title: 'Thời gian',
      key: 'timeInfo',
      width: 140,
      render: (_, record: Payment) => (
        <div style={{ fontSize: '11px' }}>
          <div>Tạo: {new Date(record.createdAt).toLocaleDateString('vi-VN')}</div>
          {record.completedAt && (
            <div style={{ color: 'green' }}>
              Hoàn thành: {new Date(record.completedAt).toLocaleDateString('vi-VN')}
            </div>
          )}
          {record.expiredAt && record.status === 'expired' && (
            <div style={{ color: 'red' }}>
              Hết hạn: {new Date(record.expiredAt).toLocaleDateString('vi-VN')}
            </div>
          )}
        </div>
      ),
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 150,
      render: (_, record: Payment) => (
        <Space size="small">
          <Tooltip title="Xem chi tiết">
            <Button
              type="primary"
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetails(record)}
            />
          </Tooltip>
          {record.status === 'pending' && (
            <Tooltip title="Hoàn thành thanh toán">
              <Button
                type="default"
                size="small"
                icon={<CheckCircleOutlined />}
                style={{ color: 'green', borderColor: 'green' }}
                onClick={() => handleCompletePayment(record)}
              />
            </Tooltip>
          )}
          {record.status === 'completed' && (
            <Tooltip title="Hoàn tiền">
              <Button
                type="default"
                size="small"
                icon={<UndoOutlined />}
                style={{ color: 'red', borderColor: 'red' }}
                onClick={() => handleRefundPayment(record)}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div className="payment-management">
      <div className="page-header">
        <h2>Quản lý Payments</h2>
      </div>

      {/* Stats Cards */}
      {paymentStats && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="Tổng doanh thu"
                value={paymentStats.totalRevenue}
                formatter={(value) => formatCurrency(Number(value))}
                prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
                loading={statsLoading}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Doanh thu tháng này"
                value={paymentStats.revenueThisMonth}
                formatter={(value) => formatCurrency(Number(value))}
                prefix={<BarChartOutlined style={{ color: '#1890ff' }} />}
                loading={statsLoading}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Tổng giao dịch"
                value={paymentStats.totalPayments}
                prefix={<CreditCardOutlined style={{ color: '#722ed1' }} />}
                loading={statsLoading}
              />
              <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
                Hoàn thành: {paymentStats.completedPayments} | Đang chờ: {paymentStats.pendingPayments}
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Giao dịch tháng này"
                value={paymentStats.paymentsThisMonth}
                prefix={<CheckCircleOutlined style={{ color: '#f5222d' }} />}
                loading={statsLoading}
              />
              <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
                Thất bại: {paymentStats.failedPayments} | Hết hạn: {paymentStats.expiredPayments}
              </div>
            </Card>
          </Col>
        </Row>
      )}

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Space size="middle" wrap>
          <Input.Search
            placeholder="Tìm kiếm theo ID, userKey, planId..."
            allowClear
            style={{ width: 300 }}
            onSearch={handleSearch}
            prefix={<SearchOutlined />}
          />
          <Select
            value={statusFilter}
            style={{ width: 120 }}
            onChange={handleStatusFilter}
          >
            <Option value="all">Tất cả</Option>
            <Option value="completed">Hoàn thành</Option>
            <Option value="pending">Đang chờ</Option>
            <Option value="failed">Thất bại</Option>
            <Option value="expired">Hết hạn</Option>
            <Option value="refunded">Hoàn tiền</Option>
          </Select>
          <Select
            value={paymentMethodFilter}
            style={{ width: 140 }}
            onChange={handlePaymentMethodFilter}
          >
            <Option value="all">Tất cả phương thức</Option>
            <Option value="bank_transfer">Chuyển khoản</Option>
            <Option value="qr_code">QR Code</Option>
            <Option value="momo">MoMo</Option>
            <Option value="zalopay">ZaloPay</Option>
          </Select>
          <RangePicker
            style={{ width: 240 }}
            onChange={handleDateRangeChange}
            placeholder={['Từ ngày', 'Đến ngày']}
          />
          <Button 
            icon={<ReloadOutlined />} 
            onClick={() => {
              loadPayments(1);
              loadPaymentStats();
            }}
          >
            Làm mới
          </Button>
        </Space>
      </Card>

      {/* Payments Table */}
      <Card>
        <Table
          columns={columns}
          dataSource={payments}
          rowKey="_id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} của ${total} payments`,
          }}
          onChange={handleTableChange}
          scroll={{ x: 1000 }}
          size="small"
        />
      </Card>

      {/* Payment Detail Modal */}
      <Modal
        title={`Chi tiết Payment - ${selectedPayment?._id.slice(-8)}`}
        visible={isDetailModalVisible}
        onCancel={() => {
          setIsDetailModalVisible(false);
          setSelectedPayment(null);
        }}
        footer={[
          <Button key="close" onClick={() => setIsDetailModalVisible(false)}>
            Đóng
          </Button>
        ]}
        width={800}
      >
        {selectedPayment && (
          <div>
            <Row gutter={16}>
              <Col span={12}>
                <Card title="Thông tin cơ bản" size="small">
                  <p><strong>Payment ID:</strong> {selectedPayment._id}</p>
                  <p><strong>User:</strong> {selectedPayment.userKey || selectedPayment.userId || 'N/A'}</p>
                  <p><strong>Plan ID:</strong> {selectedPayment.planId || 'N/A'}</p>
                  <p><strong>Credit Amount:</strong> {selectedPayment.creditAmount || 'N/A'}</p>
                  <p><strong>Số tiền:</strong> {formatCurrency(selectedPayment.price)}</p>
                  <p><strong>Trạng thái:</strong> 
                    <Tag color={getStatusColor(selectedPayment.status)} style={{ marginLeft: 8 }}>
                      {getStatusText(selectedPayment.status)}
                    </Tag>
                  </p>
                  <p><strong>Phương thức:</strong> {getPaymentMethodText(selectedPayment.paymentMethod)}</p>
                  <p><strong>Transaction ID:</strong> {selectedPayment.transactionId || 'N/A'}</p>
                </Card>
              </Col>
              <Col span={12}>
                <Card title="Thời gian" size="small">
                  <p><strong>Ngày tạo:</strong> {new Date(selectedPayment.createdAt).toLocaleString('vi-VN')}</p>
                  {selectedPayment.completedAt && (
                    <p><strong>Hoàn thành:</strong> {new Date(selectedPayment.completedAt).toLocaleString('vi-VN')}</p>
                  )}
                  {selectedPayment.expiredAt && (
                    <p><strong>Hết hạn:</strong> {new Date(selectedPayment.expiredAt).toLocaleString('vi-VN')}</p>
                  )}
                </Card>
              </Col>
            </Row>

            {selectedPayment.paymentData && (
              <Card title="Dữ liệu thanh toán" size="small" style={{ marginTop: 16 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    {selectedPayment.paymentData.orderCode && (
                      <p><strong>Order Code:</strong> {selectedPayment.paymentData.orderCode}</p>
                    )}
                    {selectedPayment.paymentData.payosPaymentLinkId && (
                      <p><strong>PayOS Link ID:</strong> {selectedPayment.paymentData.payosPaymentLinkId}</p>
                    )}
                    {selectedPayment.paymentData.transferContent && (
                      <p><strong>Nội dung chuyển khoản:</strong> {selectedPayment.paymentData.transferContent}</p>
                    )}
                    {selectedPayment.paymentData.bankAccount && (
                      <p><strong>Tài khoản ngân hàng:</strong> {selectedPayment.paymentData.bankAccount}</p>
                    )}
                  </Col>
                  <Col span={12}>
                    {selectedPayment.paymentData.payUrl && (
                      <p><strong>Pay URL:</strong> 
                        <a href={selectedPayment.paymentData.payUrl} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8 }}>
                          Mở link thanh toán
                        </a>
                      </p>
                    )}
                    {selectedPayment.paymentData.qrCode && (
                      <p><strong>QR Code:</strong> 
                        <a href={selectedPayment.paymentData.qrCode} target="_blank" rel="noopener noreferrer" style={{ marginLeft: 8 }}>
                          Xem QR
                        </a>
                      </p>
                    )}
                  </Col>
                </Row>
              </Card>
            )}

            {selectedPayment.metadata && (
              <Card title="Metadata" size="small" style={{ marginTop: 16 }}>
                <Row gutter={16}>
                  <Col span={12}>
                    {selectedPayment.metadata.ip && (
                      <p><strong>IP Address:</strong> {selectedPayment.metadata.ip}</p>
                    )}
                    {selectedPayment.metadata.referer && (
                      <p><strong>Referer:</strong> {selectedPayment.metadata.referer}</p>
                    )}
                  </Col>
                  <Col span={12}>
                    {selectedPayment.metadata.userAgent && (
                      <p><strong>User Agent:</strong> 
                        <span style={{ fontSize: '11px', wordBreak: 'break-all' }}>
                          {selectedPayment.metadata.userAgent}
                        </span>
                      </p>
                    )}
                  </Col>
                </Row>
              </Card>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default PaymentManagement;