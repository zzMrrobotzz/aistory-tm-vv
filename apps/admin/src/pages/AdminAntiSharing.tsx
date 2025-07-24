import React, { useState, useEffect } from 'react';
import { 
  Table, 
  Tag, 
  Button, 
  Modal, 
  Card, 
  Statistic, 
  Row, 
  Col, 
  Input, 
  Select, 
  Space,
  Descriptions,
  Progress,
  Alert,
  Badge,
  Tooltip,
  DatePicker,
  message,
  Tabs
} from 'antd';
import { 
  EyeOutlined, 
  UnlockOutlined, 
  LockOutlined,
  SearchOutlined,
  ReloadOutlined,
  ExclamationCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  UserOutlined,
  DesktopOutlined,
  GlobalOutlined
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import { keyService } from '../services/keyService';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

interface BlockedAccount {
  _id: string;
  userId: string;
  username: string;
  blockType: 'TEMPORARY' | 'PERMANENT' | 'RESTRICTED';
  blockReason: string;
  blockLevel: string;
  sharingScore: number;
  scoreBreakdown: {
    hardwareScore: number;
    behaviorScore: number;
    sessionScore: number;
  };
  blockedAt: string;
  blockedUntil?: string;
  status: 'ACTIVE' | 'EXPIRED' | 'APPEALED' | 'UNBLOCKED';
  evidence: {
    concurrentSessions: number;
    deviceCount: number;
    locationChanges: number;
    ipAddresses: string[];
    suspiciousPatterns: string[];
  };
  appealInfo?: {
    appealedAt?: string;
    appealReason?: string;
    appealStatus: string;
    reviewedBy?: string;
    reviewNotes?: string;
  };
}

interface DeviceFingerprint {
  _id: string;
  userId: string;
  username: string;
  fingerprint: string;
  deviceInfo: any;
  ipAddress: string;
  isActive: boolean;
  isVerified: boolean;
  deviceName: string;
  firstSeen: string;
  lastSeen: string;
  sessionCount: number;
  suspiciousActivity: {
    rapidLocationChanges: number;
    unusualUsageHours: number;
    simultaneousActivity: number;
  };
}

interface UserSession {
  _id: string;
  userId: string;
  username: string;
  sessionToken: string;
  ipAddress: string;
  isActive: boolean;
  loginAt: string;
  lastActivity: string;
  logoutAt?: string;
  logoutReason?: string;
  activityMetrics: {
    totalApiCalls: number;
    totalTimeActive: number;
    featuresUsed: string[];
  };
  securityFlags: {
    rapidLocationChange: boolean;
    suspiciousTiming: boolean;
    unusualBehavior: boolean;
    concurrentSessions: boolean;
  };
}

interface AntiSharingStats {
  totalBlocks: number;
  activeBlocks: number;
  appealsPending: number;
  suspiciousAccounts: number;
  totalDevices: number;
  activeSessions: number;
  averageSharingScore: number;
  blocksToday: number;
}

const AdminAntiSharing: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [blockedAccounts, setBlockedAccounts] = useState<BlockedAccount[]>([]);
  const [devices, setDevices] = useState<DeviceFingerprint[]>([]);
  const [sessions, setSessions] = useState<UserSession[]>([]);
  const [stats, setStats] = useState<AntiSharingStats | null>(null);
  
  const [selectedAccount, setSelectedAccount] = useState<BlockedAccount | null>(null);
  const [detailsVisible, setDetailsVisible] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('blocks');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        loadBlockedAccounts(),
        loadDevices(),
        loadSessions(),
        loadStats()
      ]);
    } catch (error) {
      message.error('Failed to load anti-sharing data');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const loadBlockedAccounts = async () => {
    try {
      const response = await fetch('https://aistory-backend.onrender.com/api/admin/anti-sharing/blocks');
      const data = await response.json();
      setBlockedAccounts(data.blocks || []);
    } catch (error) {
      console.error('Failed to load blocked accounts:', error);
    }
  };

  const loadDevices = async () => {
    try {
      const response = await fetch('https://aistory-backend.onrender.com/api/admin/anti-sharing/devices');
      const data = await response.json();
      setDevices(data.devices || []);
    } catch (error) {
      console.error('Failed to load devices:', error);
    }
  };

  const loadSessions = async () => {
    try {
      const response = await fetch('https://aistory-backend.onrender.com/api/admin/anti-sharing/sessions');
      const data = await response.json();
      setSessions(data.sessions || []);
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  };

  const loadStats = async () => {
    try {
      const response = await fetch('https://aistory-backend.onrender.com/api/admin/anti-sharing/stats');
      const data = await response.json();
      setStats(data.stats);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleUnblockAccount = async (accountId: string) => {
    Modal.confirm({
      title: 'Unblock Account',
      content: 'Are you sure you want to unblock this account?',
      onOk: async () => {
        try {
          await fetch(`https://aistory-backend.onrender.com/api/admin/anti-sharing/blocks/${accountId}/unblock`, {
            method: 'POST'
          });
          message.success('Account unblocked successfully');
          loadBlockedAccounts();
        } catch (error) {
          message.error('Failed to unblock account');
        }
      }
    });
  };

  const handleReviewAppeal = async (accountId: string, approved: boolean, notes: string) => {
    try {
      await fetch(`https://aistory-backend.onrender.com/api/admin/anti-sharing/blocks/${accountId}/review-appeal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approved, notes })
      });
      message.success(`Appeal ${approved ? 'approved' : 'rejected'} successfully`);
      loadBlockedAccounts();
    } catch (error) {
      message.error('Failed to review appeal');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE': return 'red';
      case 'EXPIRED': return 'default';
      case 'APPEALED': return 'blue';
      case 'UNBLOCKED': return 'green';
      default: return 'default';
    }
  };

  const getSharingScoreColor = (score: number) => {
    if (score >= 85) return '#ff4d4f';
    if (score >= 75) return '#fa8c16';
    if (score >= 60) return '#fadb14';
    return '#52c41a';
  };

  const filteredBlocks = blockedAccounts.filter(account => {
    const matchesSearch = account.username.toLowerCase().includes(searchText.toLowerCase()) ||
                         account.userId.includes(searchText);
    const matchesStatus = statusFilter === 'all' || account.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const blockColumns: ColumnsType<BlockedAccount> = [
    {
      title: 'User',
      dataIndex: 'username',
      key: 'username',
      render: (username: string, record: BlockedAccount) => (
        <Space>
          <UserOutlined />
          <div>
            <div>{username}</div>
            <div style={{ fontSize: '12px', color: '#999' }}>
              {record.userId.substring(0, 8)}...
            </div>
          </div>
        </Space>
      ),
    },
    {
      title: 'Sharing Score',
      dataKey: 'sharingScore',
      key: 'sharingScore',
      render: (score: number) => (
        <Progress
          percent={score}
          size="small"
          strokeColor={getSharingScoreColor(score)}
          format={percent => `${percent}/100`}
        />
      ),
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={getStatusColor(status)}>{status}</Tag>
      ),
    },
    {
      title: 'Block Reason',
      dataIndex: 'blockReason',
      key: 'blockReason',
      render: (reason: string) => reason.replace(/_/g, ' '),
    },
    {
      title: 'Blocked At',
      dataIndex: 'blockedAt',
      key: 'blockedAt',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Expires At',
      dataIndex: 'blockedUntil',
      key: 'blockedUntil',
      render: (date: string) => date ? new Date(date).toLocaleString() : 'Never',
    },
    {
      title: 'Evidence',
      key: 'evidence',
      render: (_, record: BlockedAccount) => (
        <Space>
          <Tooltip title="Concurrent Sessions">
            <Badge count={record.evidence.concurrentSessions}>
              <UserOutlined />
            </Badge>
          </Tooltip>
          <Tooltip title="Device Count">
            <Badge count={record.evidence.deviceCount}>
              <DesktopOutlined />
            </Badge>
          </Tooltip>
          <Tooltip title="IP Addresses">
            <Badge count={record.evidence.ipAddresses.length}>
              <GlobalOutlined />
            </Badge>
          </Tooltip>
        </Space>
      ),
    },
    {
      title: 'Actions',
      key: 'actions',
      render: (_, record: BlockedAccount) => (
        <Space>
          <Button 
            icon={<EyeOutlined />} 
            size="small"
            onClick={() => {
              setSelectedAccount(record);
              setDetailsVisible(true);
            }}
          >
            Details
          </Button>
          {record.status === 'ACTIVE' && (
            <Button 
              icon={<UnlockOutlined />} 
              size="small"
              type="primary"
              onClick={() => handleUnblockAccount(record._id)}
            >
              Unblock
            </Button>
          )}
          {record.appealInfo?.appealStatus === 'PENDING' && (
            <Button 
              icon={<CheckCircleOutlined />} 
              size="small"
              type="link"
              onClick={() => {
                Modal.confirm({
                  title: 'Review Appeal',
                  content: (
                    <div>
                      <p><strong>Appeal Reason:</strong> {record.appealInfo?.appealReason}</p>
                      <Input.TextArea 
                        placeholder="Review notes..."
                        id="review-notes"
                      />
                    </div>
                  ),
                  onOk: () => {
                    const notes = (document.getElementById('review-notes') as HTMLTextAreaElement)?.value || '';
                    handleReviewAppeal(record._id, true, notes);
                  }
                });
              }}
            >
              Review Appeal
            </Button>
          )}
        </Space>
      ),
    },
  ];

  const deviceColumns: ColumnsType<DeviceFingerprint> = [
    {
      title: 'User',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: 'Device Name',
      dataIndex: 'deviceName',
      key: 'deviceName',
    },
    {
      title: 'IP Address',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
    },
    {
      title: 'Sessions',
      dataIndex: 'sessionCount',
      key: 'sessionCount',
    },
    {
      title: 'First Seen',
      dataIndex: 'firstSeen',
      key: 'firstSeen',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Last Seen',
      dataIndex: 'lastSeen',
      key: 'lastSeen',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Status',
      key: 'status',
      render: (_, record: DeviceFingerprint) => (
        <Space>
          <Tag color={record.isActive ? 'green' : 'red'}>
            {record.isActive ? 'Active' : 'Inactive'}
          </Tag>
          {record.isVerified && <Tag color="blue">Verified</Tag>}
        </Space>
      ),
    },
    {
      title: 'Suspicious Activity',
      key: 'suspicious',
      render: (_, record: DeviceFingerprint) => {
        const total = record.suspiciousActivity.rapidLocationChanges + 
                     record.suspiciousActivity.unusualUsageHours + 
                     record.suspiciousActivity.simultaneousActivity;
        return total > 0 ? <Tag color="orange">{total} flags</Tag> : <Tag color="green">Clean</Tag>;
      },
    },
  ];

  const sessionColumns: ColumnsType<UserSession> = [
    {
      title: 'User',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: 'IP Address',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
    },
    {
      title: 'Login At',
      dataIndex: 'loginAt',
      key: 'loginAt',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Last Activity',
      dataIndex: 'lastActivity',
      key: 'lastActivity',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'API Calls',
      dataIndex: ['activityMetrics', 'totalApiCalls'],
      key: 'apiCalls',
    },
    {
      title: 'Status',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'red'}>
          {active ? 'Active' : 'Inactive'}
        </Tag>
      ),
    },
    {
      title: 'Security Flags',
      key: 'securityFlags',
      render: (_, record: UserSession) => {
        const flags = Object.entries(record.securityFlags)
          .filter(([_, value]) => value)
          .map(([key, _]) => key);
        
        return flags.length > 0 ? (
          <Space>
            {flags.map(flag => (
              <Tag key={flag} color="red" icon={<WarningOutlined />}>
                {flag.replace(/([A-Z])/g, ' $1').toLowerCase()}
              </Tag>
            ))}
          </Space>
        ) : (
          <Tag color="green" icon={<CheckCircleOutlined />}>Clean</Tag>
        );
      },
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ marginBottom: '24px' }}>
        <h1>Anti-Sharing Management</h1>
        <p>Monitor and manage account sharing detection</p>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <Row gutter={16} style={{ marginBottom: '24px' }}>
          <Col span={3}>
            <Card>
              <Statistic
                title="Total Blocks"
                value={stats.totalBlocks}
                prefix={<LockOutlined />}
              />
            </Card>
          </Col>
          <Col span={3}>
            <Card>
              <Statistic
                title="Active Blocks"
                value={stats.activeBlocks}
                valueStyle={{ color: '#cf1322' }}
                prefix={<ExclamationCircleOutlined />}
              />
            </Card>
          </Col>
          <Col span={3}>
            <Card>
              <Statistic
                title="Pending Appeals"
                value={stats.appealsPending}
                valueStyle={{ color: '#1890ff' }}
                prefix={<EyeOutlined />}
              />
            </Card>
          </Col>
          <Col span={3}>
            <Card>
              <Statistic
                title="Suspicious Accounts"
                value={stats.suspiciousAccounts}
                valueStyle={{ color: '#fa8c16' }}
                prefix={<WarningOutlined />}
              />
            </Card>
          </Col>
          <Col span={3}>
            <Card>
              <Statistic
                title="Total Devices"
                value={stats.totalDevices}
                prefix={<DesktopOutlined />}
              />
            </Card>
          </Col>
          <Col span={3}>
            <Card>
              <Statistic
                title="Active Sessions"
                value={stats.activeSessions}
                prefix={<UserOutlined />}
              />
            </Card>
          </Col>
          <Col span={3}>
            <Card>
              <Statistic
                title="Avg Score"
                value={stats.averageSharingScore}
                precision={1}
                suffix="/100"
                valueStyle={{ color: getSharingScoreColor(stats.averageSharingScore) }}
              />
            </Card>
          </Col>
          <Col span={3}>
            <Card>
              <Statistic
                title="Blocks Today"
                value={stats.blocksToday}
                valueStyle={{ color: stats.blocksToday > 0 ? '#cf1322' : '#52c41a' }}
              />
            </Card>
          </Col>
        </Row>
      )}

      {/* Controls */}
      <Card style={{ marginBottom: '24px' }}>
        <Row gutter={16} align="middle">
          <Col span={8}>
            <Input
              placeholder="Search by username or user ID..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
            />
          </Col>
          {activeTab === 'blocks' && (
            <Col span={4}>
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: '100%' }}
              >
                <Option value="all">All Status</Option>
                <Option value="ACTIVE">Active</Option>
                <Option value="EXPIRED">Expired</Option>
                <Option value="APPEALED">Appealed</Option>
                <Option value="UNBLOCKED">Unblocked</Option>
              </Select>
            </Col>
          )}
          <Col span={4}>
            <Button 
              icon={<ReloadOutlined />} 
              onClick={loadData}
              loading={loading}
            >
              Refresh
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Main Content Tabs */}
      <Card>
        <Tabs activeKey={activeTab} onChange={setActiveTab}>
          <TabPane tab={`Blocked Accounts (${filteredBlocks.length})`} key="blocks">
            <Table
              columns={blockColumns}
              dataSource={filteredBlocks}
              rowKey="_id"
              loading={loading}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showQuickJumper: true,
              }}
            />
          </TabPane>
          
          <TabPane tab={`Device Fingerprints (${devices.length})`} key="devices">
            <Table
              columns={deviceColumns}
              dataSource={devices}
              rowKey="_id"
              loading={loading}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showQuickJumper: true,
              }}
            />
          </TabPane>
          
          <TabPane tab={`User Sessions (${sessions.length})`} key="sessions">
            <Table
              columns={sessionColumns}
              dataSource={sessions}
              rowKey="_id"
              loading={loading}
              pagination={{
                pageSize: 20,
                showSizeChanger: true,
                showQuickJumper: true,
              }}
            />
          </TabPane>
        </Tabs>
      </Card>

      {/* Details Modal */}
      <Modal
        title="Account Block Details"
        open={detailsVisible}
        onCancel={() => setDetailsVisible(false)}
        footer={null}
        width={800}
      >
        {selectedAccount && (
          <div>
            <Alert
              message={`Account blocked due to ${selectedAccount.blockReason.replace(/_/g, ' ').toLowerCase()}`}
              type="error"
              style={{ marginBottom: '16px' }}
            />
            
            <Descriptions column={2} bordered>
              <Descriptions.Item label="Username">
                {selectedAccount.username}
              </Descriptions.Item>
              <Descriptions.Item label="User ID">
                {selectedAccount.userId}
              </Descriptions.Item>
              <Descriptions.Item label="Sharing Score">
                <Progress
                  percent={selectedAccount.sharingScore}
                  strokeColor={getSharingScoreColor(selectedAccount.sharingScore)}
                />
              </Descriptions.Item>
              <Descriptions.Item label="Block Type">
                <Tag color={selectedAccount.blockType === 'PERMANENT' ? 'red' : 'orange'}>
                  {selectedAccount.blockType}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Blocked At">
                {new Date(selectedAccount.blockedAt).toLocaleString()}
              </Descriptions.Item>
              <Descriptions.Item label="Expires At">
                {selectedAccount.blockedUntil 
                  ? new Date(selectedAccount.blockedUntil).toLocaleString()
                  : 'Never'
                }
              </Descriptions.Item>
            </Descriptions>

            <h4 style={{ marginTop: '16px' }}>Score Breakdown</h4>
            <Row gutter={16}>
              <Col span={8}>
                <Progress
                  type="circle"
                  percent={selectedAccount.scoreBreakdown.hardwareScore}
                  format={percent => `Hardware\n${percent}`}
                  size={80}
                />
              </Col>
              <Col span={8}>
                <Progress
                  type="circle"
                  percent={selectedAccount.scoreBreakdown.behaviorScore}
                  format={percent => `Behavior\n${percent}`}
                  size={80}
                />
              </Col>
              <Col span={8}>
                <Progress
                  type="circle"
                  percent={selectedAccount.scoreBreakdown.sessionScore}
                  format={percent => `Session\n${percent}`}
                  size={80}
                />
              </Col>
            </Row>

            <h4 style={{ marginTop: '16px' }}>Evidence</h4>
            <Descriptions column={2} bordered>
              <Descriptions.Item label="Concurrent Sessions">
                {selectedAccount.evidence.concurrentSessions}
              </Descriptions.Item>
              <Descriptions.Item label="Device Count">
                {selectedAccount.evidence.deviceCount}
              </Descriptions.Item>
              <Descriptions.Item label="Location Changes">
                {selectedAccount.evidence.locationChanges}
              </Descriptions.Item>
              <Descriptions.Item label="IP Addresses">
                {selectedAccount.evidence.ipAddresses.join(', ')}
              </Descriptions.Item>
              <Descriptions.Item label="Suspicious Patterns" span={2}>
                <Space wrap>
                  {selectedAccount.evidence.suspiciousPatterns.map((pattern, index) => (
                    <Tag key={index} color="red">{pattern}</Tag>
                  ))}
                </Space>
              </Descriptions.Item>
            </Descriptions>

            {selectedAccount.appealInfo && (
              <>
                <h4 style={{ marginTop: '16px' }}>Appeal Information</h4>
                <Descriptions column={1} bordered>
                  <Descriptions.Item label="Appeal Status">
                    <Tag color="blue">{selectedAccount.appealInfo.appealStatus}</Tag>
                  </Descriptions.Item>
                  <Descriptions.Item label="Appeal Reason">
                    {selectedAccount.appealInfo.appealReason}
                  </Descriptions.Item>
                  {selectedAccount.appealInfo.reviewedBy && (
                    <Descriptions.Item label="Reviewed By">
                      {selectedAccount.appealInfo.reviewedBy}
                    </Descriptions.Item>
                  )}
                  {selectedAccount.appealInfo.reviewNotes && (
                    <Descriptions.Item label="Review Notes">
                      {selectedAccount.appealInfo.reviewNotes}
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminAntiSharing;