import {
  List,
  useTable,
  EditButton,
  TagField,
} from '@refinedev/antd';
import { useCustom } from '@refinedev/core';
import { Table, Space, Select, Button, Card, Row, Col, Statistic, Tag, Tooltip, Progress, Popconfirm, message, Collapse, List as AntList, Avatar, Modal, Form, InputNumber, Radio } from 'antd';
import {
  ReloadOutlined,
  SafetyCertificateOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  UserOutlined,
  WifiOutlined,
  StopOutlined,
  PlusOutlined,
  StarOutlined,
  WalletOutlined,
  HistoryOutlined,
  GiftOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import dayjs from 'dayjs';
import { ExportButton } from '../../components';

interface VPNSubscription {
  id: number;
  telegram_id: number;
  plan_type: string;
  protocol: string;
  status: string;
  marzban_username: string;
  subscription_url: string | null;
  traffic_limit_gb: number;
  traffic_used_gb: number;
  started_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
  days_remaining: number | null;
  traffic_percent: number | null;
}

interface VPNStats {
  active_subscriptions: number;
  total_subscriptions: number;
  expiring_soon: number;
  new_today: number;
  total_revenue_stars: number;
  total_revenue_rub: number;
  total_payments: number;
  by_plan: Record<string, { count: number; revenue_stars: number }>;
  by_protocol: Record<string, number>;
}

interface BotBalance {
  balance: number;
  balance_rub: number;
}

interface StarTransaction {
  id: string;
  amount: number;
  date: number;
  source?: {
    type: string;
    user?: {
      id: number;
      first_name: string;
      last_name?: string;
      username?: string;
    };
  };
  receiver?: unknown;
}

interface TransactionsResponse {
  transactions: StarTransaction[];
  total: number;
}

const statusColors: Record<string, string> = {
  pending: 'orange',
  active: 'green',
  expired: 'red',
  cancelled: 'default',
};

const statusLabels: Record<string, string> = {
  pending: 'Ожидает',
  active: 'Активна',
  expired: 'Истекла',
  cancelled: 'Отменена',
};

const planLabels: Record<string, string> = {
  month_1: '1 мес',
  month_3: '3 мес',
  year_1: '12 мес',
};

const protocolLabels: Record<string, string> = {
  vless: 'VLESS Reality',
  shadowsocks: 'Outline',
};

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const VPNList = () => {
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [planFilter, setPlanFilter] = useState<string | undefined>();
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createForm] = Form.useForm();

  const { tableProps, tableQueryResult } = useTable<VPNSubscription>({
    resource: 'vpn/subscriptions',
    syncWithLocation: true,
    filters: {
      permanent: [
        ...(statusFilter ? [{ field: 'status_filter', operator: 'eq' as const, value: statusFilter }] : []),
        ...(planFilter ? [{ field: 'plan_filter', operator: 'eq' as const, value: planFilter }] : []),
      ],
    },
  });

  // Fetch stats
  const { data: statsData, refetch: refetchStats } = useCustom<VPNStats>({
    url: '/vpn/stats',
    method: 'get',
  });

  // Fetch bot balance (Stars)
  const { data: balanceData, refetch: refetchBalance } = useCustom<BotBalance>({
    url: '/vpn/balance',
    method: 'get',
  });

  // Fetch Star transactions
  const { data: transactionsData, refetch: refetchTransactions } = useCustom<TransactionsResponse>({
    url: '/vpn/transactions',
    method: 'get',
    config: {
      query: { limit: 10 },
    },
  });

  const stats = statsData?.data;
  const balance = balanceData?.data;
  const transactions = transactionsData?.data?.transactions || [];

  const handleDisable = async (id: number) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/vpn/subscriptions/${id}/disable`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        message.success('Подписка отключена');
        tableQueryResult.refetch();
        refetchStats();
      } else {
        message.error('Ошибка при отключении');
      }
    } catch {
      message.error('Ошибка при отключении');
    }
  };

  const handleExtend = async (id: number, days: number) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/vpn/subscriptions/${id}/extend?days=${days}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        message.success(`Подписка продлена на ${days} дней`);
        tableQueryResult.refetch();
        refetchStats();
      } else {
        message.error('Ошибка при продлении');
      }
    } catch {
      message.error('Ошибка при продлении');
    }
  };

  const handleCreate = async (values: { telegram_id: number; plan_type: string; protocol: string }) => {
    setCreateLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/vpn/subscriptions/create`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });
      if (response.ok) {
        const data = await response.json();
        message.success(`Подписка создана! Marzban: ${data.marzban_username}`);
        setCreateModalOpen(false);
        createForm.resetFields();
        tableQueryResult.refetch();
        refetchStats();
      } else {
        const error = await response.json();
        message.error(error.detail || 'Ошибка при создании');
      }
    } catch {
      message.error('Ошибка при создании подписки');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <List
      title="VPN Подписки"
      headerButtons={() => (
        <Space>
          <Button
            type="primary"
            icon={<GiftOutlined />}
            onClick={() => setCreateModalOpen(true)}
          >
            Создать подписку
          </Button>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => {
              tableQueryResult.refetch();
              refetchStats();
              refetchBalance();
              refetchTransactions();
            }}
          >
            Обновить
          </Button>
          <ExportButton resource="vpn/subscriptions" />
        </Space>
      )}
    >
      {/* Bot Balance Card */}
      <Row gutter={16} style={{ marginBottom: 16 }}>
        <Col span={12}>
          <Card
            style={{
              background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
              border: 'none',
            }}
          >
            <Row gutter={16} align="middle">
              <Col span={12}>
                <Statistic
                  title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>Баланс бота (Stars)</span>}
                  value={balance?.balance ?? '—'}
                  prefix={<StarOutlined style={{ color: '#ffd700' }} />}
                  suffix="⭐"
                  valueStyle={{ color: '#fff', fontSize: 32 }}
                />
              </Col>
              <Col span={12}>
                <Statistic
                  title={<span style={{ color: 'rgba(255,255,255,0.8)' }}>≈ в рублях</span>}
                  value={balance?.balance_rub ?? '—'}
                  prefix={<WalletOutlined style={{ color: '#52c41a' }} />}
                  suffix="₽"
                  valueStyle={{ color: '#fff', fontSize: 32 }}
                />
              </Col>
            </Row>
          </Card>
        </Col>
        <Col span={12}>
          <Card size="small" style={{ height: '100%' }}>
            <div style={{ color: '#888', marginBottom: 8 }}>Информация о выводе</div>
            <div style={{ fontSize: 13 }}>
              Звёзды можно вывести через <a href="https://fragment.com" target="_blank" rel="noopener noreferrer">Fragment</a> в TON.
              <br />
              Минимум для вывода: <strong>1000 ⭐</strong>
              <br />
              Курс: ~2 руб / звезда (минус комиссия ~30%)
            </div>
          </Card>
        </Col>
      </Row>

      {/* Recent Transactions */}
      <Collapse
        style={{ marginBottom: 16 }}
        items={[
          {
            key: 'transactions',
            label: (
              <Space>
                <HistoryOutlined />
                <span>Последние транзакции Stars ({transactions.length})</span>
              </Space>
            ),
            children: (
              <AntList
                size="small"
                dataSource={transactions}
                locale={{ emptyText: 'Нет транзакций' }}
                renderItem={(txn: StarTransaction) => (
                  <AntList.Item>
                    <AntList.Item.Meta
                      avatar={
                        <Avatar
                          style={{ backgroundColor: txn.amount > 0 ? '#52c41a' : '#ff4d4f' }}
                          icon={<StarOutlined />}
                        />
                      }
                      title={
                        <Space>
                          <span style={{ color: txn.amount > 0 ? '#52c41a' : '#ff4d4f' }}>
                            {txn.amount > 0 ? '+' : ''}{txn.amount} ⭐
                          </span>
                          {txn.source?.user && (
                            <Tag>
                              {txn.source.user.first_name}
                              {txn.source.user.username && ` @${txn.source.user.username}`}
                            </Tag>
                          )}
                        </Space>
                      }
                      description={
                        <span style={{ color: '#888' }}>
                          {dayjs.unix(txn.date).format('DD.MM.YYYY HH:mm')}
                          {txn.source?.type && ` • ${txn.source.type}`}
                        </span>
                      }
                    />
                  </AntList.Item>
                )}
              />
            ),
          },
        ]}
      />

      {/* Stats Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Активных подписок"
              value={stats?.active_subscriptions || 0}
              prefix={<SafetyCertificateOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Доход (Stars)"
              value={stats?.total_revenue_stars || 0}
              prefix={<DollarOutlined />}
              suffix="⭐"
            />
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              ~{stats?.total_revenue_rub || 0} ₽
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Истекают (3 дня)"
              value={stats?.expiring_soon || 0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: (stats?.expiring_soon || 0) > 0 ? '#faad14' : undefined }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Новых сегодня"
              value={stats?.new_today || 0}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Protocol breakdown */}
      {stats?.by_protocol && (
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={12}>
            <Card size="small">
              <Space>
                <WifiOutlined />
                <span>VLESS Reality: <strong>{stats.by_protocol.vless || 0}</strong></span>
                <span style={{ marginLeft: 16 }}>Outline: <strong>{stats.by_protocol.shadowsocks || 0}</strong></span>
              </Space>
            </Card>
          </Col>
          <Col span={12}>
            <Card size="small">
              <Space>
                <DollarOutlined />
                {Object.entries(stats.by_plan || {}).map(([plan, data]) => (
                  <span key={plan} style={{ marginRight: 16 }}>
                    {planLabels[plan] || plan}: <strong>{data.count}</strong> ({data.revenue_stars}⭐)
                  </span>
                ))}
              </Space>
            </Card>
          </Col>
        </Row>
      )}

      {/* Filters */}
      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder="Статус"
          style={{ width: 150 }}
          allowClear
          value={statusFilter}
          onChange={(v) => setStatusFilter(v)}
          options={[
            { label: 'Активные', value: 'active' },
            { label: 'Ожидают', value: 'pending' },
            { label: 'Истекшие', value: 'expired' },
            { label: 'Отменённые', value: 'cancelled' },
          ]}
        />
        <Select
          placeholder="Тариф"
          style={{ width: 150 }}
          allowClear
          value={planFilter}
          onChange={(v) => setPlanFilter(v)}
          options={[
            { label: '1 месяц', value: 'month_1' },
            { label: '3 месяца', value: 'month_3' },
            { label: '12 месяцев', value: 'year_1' },
          ]}
        />
      </Space>

      <Table {...tableProps} rowKey="id" size="middle">
        <Table.Column
          dataIndex="telegram_id"
          title="Telegram ID"
          render={(value: number) => (
            <Space>
              <Link to={`/vpn/users/${value}`} style={{ fontWeight: 500 }}>
                {value}
              </Link>
              <Tooltip title="Открыть в Telegram">
                <a
                  href={`https://t.me/user?id=${value}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#888', fontSize: 12 }}
                >
                  <UserOutlined />
                </a>
              </Tooltip>
            </Space>
          )}
        />
        <Table.Column
          dataIndex="plan_type"
          title="Тариф"
          render={(value: string) => (
            <Tag color="blue">{planLabels[value] || value}</Tag>
          )}
        />
        <Table.Column
          dataIndex="protocol"
          title="Протокол"
          render={(value: string) => (
            <Tag color={value === 'vless' ? 'purple' : 'cyan'}>
              {protocolLabels[value] || value}
            </Tag>
          )}
        />
        <Table.Column
          dataIndex="status"
          title="Статус"
          render={(value: string) => (
            <TagField
              color={statusColors[value] || 'default'}
              value={statusLabels[value] || value}
            />
          )}
        />
        <Table.Column
          title="Трафик"
          render={(_, record: VPNSubscription) => {
            if (record.traffic_limit_gb === 0) {
              return <Tag color="green">Безлимит</Tag>;
            }
            const percent = record.traffic_percent || 0;
            const color = percent > 90 ? '#ff4d4f' : percent > 70 ? '#faad14' : '#52c41a';
            return (
              <Tooltip title={`${record.traffic_used_gb.toFixed(1)} / ${record.traffic_limit_gb} GB`}>
                <Progress
                  percent={Math.round(percent)}
                  size="small"
                  strokeColor={color}
                  style={{ width: 100 }}
                />
              </Tooltip>
            );
          }}
        />
        <Table.Column
          dataIndex="expires_at"
          title="Истекает"
          render={(value: string | null, record: VPNSubscription) => {
            if (!value) return <span style={{ color: '#888' }}>—</span>;

            const days = record.days_remaining;
            let color = undefined;
            if (days !== null) {
              if (days <= 1) color = '#ff4d4f';
              else if (days <= 3) color = '#faad14';
              else if (days <= 7) color = '#1890ff';
            }

            return (
              <Space direction="vertical" size={0}>
                <span>{dayjs(value).format('DD.MM.YYYY')}</span>
                {days !== null && (
                  <span style={{ fontSize: 12, color: color || '#888' }}>
                    {days === 0 ? 'Сегодня!' : days === 1 ? 'Завтра' : `через ${days} дн.`}
                  </span>
                )}
              </Space>
            );
          }}
        />
        <Table.Column
          dataIndex="marzban_username"
          title="Marzban"
          render={(value: string) => (
            <Tooltip title={value}>
              <code style={{ fontSize: 11 }}>{value.slice(0, 12)}...</code>
            </Tooltip>
          )}
        />
        <Table.Column
          title="Действия"
          render={(_, record: VPNSubscription) => (
            <Space>
              <EditButton hideText size="small" recordItemId={record.id} />
              {record.status === 'active' && (
                <>
                  <Popconfirm
                    title="Продлить на 30 дней?"
                    onConfirm={() => handleExtend(record.id, 30)}
                    okText="Да"
                    cancelText="Нет"
                  >
                    <Button size="small" icon={<PlusOutlined />} title="Продлить" />
                  </Popconfirm>
                  <Popconfirm
                    title="Отключить подписку?"
                    onConfirm={() => handleDisable(record.id)}
                    okText="Да"
                    cancelText="Нет"
                  >
                    <Button size="small" danger icon={<StopOutlined />} title="Отключить" />
                  </Popconfirm>
                </>
              )}
            </Space>
          )}
        />
      </Table>

      {/* Create Subscription Modal */}
      <Modal
        title={
          <Space>
            <GiftOutlined />
            <span>Создать подписку вручную</span>
          </Space>
        }
        open={createModalOpen}
        onCancel={() => {
          setCreateModalOpen(false);
          createForm.resetFields();
        }}
        footer={null}
        destroyOnClose
      >
        <Form
          form={createForm}
          layout="vertical"
          onFinish={handleCreate}
          initialValues={{
            plan_type: 'month_1',
            protocol: 'vless',
          }}
        >
          <Form.Item
            name="telegram_id"
            label="Telegram ID пользователя"
            rules={[
              { required: true, message: 'Введите Telegram ID' },
              { type: 'number', min: 1, message: 'Некорректный ID' },
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="123456789"
              formatter={(value) => `${value}`.replace(/\D/g, '')}
            />
          </Form.Item>

          <Form.Item
            name="plan_type"
            label="Тариф"
            rules={[{ required: true }]}
          >
            <Radio.Group>
              <Radio.Button value="month_1">1 месяц (100 GB)</Radio.Button>
              <Radio.Button value="month_3">3 месяца (300 GB)</Radio.Button>
              <Radio.Button value="year_1">12 месяцев (Безлимит)</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="protocol"
            label="Протокол"
            rules={[{ required: true }]}
          >
            <Radio.Group>
              <Radio.Button value="vless">VLESS Reality</Radio.Button>
              <Radio.Button value="shadowsocks">Outline</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <div style={{ background: '#1a1a1a', padding: 12, borderRadius: 6, marginBottom: 16 }}>
            <div style={{ color: '#888', fontSize: 12 }}>
              Подписка будет создана бесплатно (для тестов/подарков).
              <br />
              Пользователь в Marzban будет создан автоматически.
            </div>
          </div>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setCreateModalOpen(false)}>Отмена</Button>
              <Button type="primary" htmlType="submit" loading={createLoading}>
                Создать
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </List>
  );
};
