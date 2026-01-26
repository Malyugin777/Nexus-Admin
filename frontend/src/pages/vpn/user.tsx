import { useParams, useNavigate } from 'react-router-dom';
import { useCustom } from '@refinedev/core';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Tag,
  Space,
  Button,
  Descriptions,
  Progress,
  Tooltip,
  Popconfirm,
  message,
  Spin,
  Result,
} from 'antd';
import {
  ArrowLeftOutlined,
  UserOutlined,
  StarOutlined,
  SafetyCertificateOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  StopOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';

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

interface VPNPayment {
  id: number;
  telegram_id: number;
  amount: number;
  currency: string;
  payment_system: string;
  payment_id: string;
  plan_type: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  subscription_id: number | null;
}

interface UserProfile {
  telegram_id: number;
  total_subscriptions: number;
  total_payments: number;
  total_spent_stars: number;
  total_spent_rub: number;
  has_active_subscription: boolean;
  active_subscription: VPNSubscription | null;
  subscriptions: VPNSubscription[];
  payments: VPNPayment[];
}

const statusColors: Record<string, string> = {
  pending: 'orange',
  active: 'green',
  expired: 'red',
  cancelled: 'default',
  completed: 'green',
  failed: 'red',
};

const statusLabels: Record<string, string> = {
  pending: 'Ожидает',
  active: 'Активна',
  expired: 'Истекла',
  cancelled: 'Отменена',
  completed: 'Завершён',
  failed: 'Ошибка',
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

export const VPNUserProfile = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const telegramId = parseInt(id || '0', 10);

  const { data, isLoading, isError, refetch } = useCustom<UserProfile>({
    url: `/vpn/users/${telegramId}`,
    method: 'get',
    queryOptions: {
      enabled: !!telegramId,
    },
  });

  const profile = data?.data;

  const handleExtend = async (subscriptionId: number, days: number) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/vpn/subscriptions/${subscriptionId}/extend?days=${days}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        message.success(`Подписка продлена на ${days} дней`);
        refetch();
      } else {
        message.error('Ошибка при продлении');
      }
    } catch {
      message.error('Ошибка при продлении');
    }
  };

  const handleDisable = async (subscriptionId: number) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/vpn/subscriptions/${subscriptionId}/disable`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
      if (response.ok) {
        message.success('Подписка отключена');
        refetch();
      } else {
        message.error('Ошибка при отключении');
      }
    } catch {
      message.error('Ошибка при отключении');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('Скопировано');
  };

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <Result
        status="404"
        title="Пользователь не найден"
        subTitle={`Пользователь с Telegram ID ${telegramId} не найден в системе`}
        extra={
          <Button type="primary" onClick={() => navigate('/vpn')}>
            Вернуться к подпискам
          </Button>
        }
      />
    );
  }

  const subscriptionColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: 'Тариф',
      dataIndex: 'plan_type',
      key: 'plan_type',
      render: (value: string) => <Tag color="blue">{planLabels[value] || value}</Tag>,
    },
    {
      title: 'Протокол',
      dataIndex: 'protocol',
      key: 'protocol',
      render: (value: string) => (
        <Tag color={value === 'vless' ? 'purple' : 'cyan'}>
          {protocolLabels[value] || value}
        </Tag>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (value: string) => (
        <Tag color={statusColors[value] || 'default'}>
          {statusLabels[value] || value}
        </Tag>
      ),
    },
    {
      title: 'Трафик',
      key: 'traffic',
      render: (_: unknown, record: VPNSubscription) => {
        if (record.traffic_limit_gb === 0) {
          return <Tag color="green">Безлимит</Tag>;
        }
        const percent = record.traffic_percent || 0;
        const color = percent > 90 ? '#ff4d4f' : percent > 70 ? '#faad14' : '#52c41a';
        return (
          <Tooltip title={`${record.traffic_used_gb.toFixed(1)} / ${record.traffic_limit_gb} GB`}>
            <Progress percent={Math.round(percent)} size="small" strokeColor={color} style={{ width: 80 }} />
          </Tooltip>
        );
      },
    },
    {
      title: 'Истекает',
      dataIndex: 'expires_at',
      key: 'expires_at',
      render: (value: string | null, record: VPNSubscription) => {
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
      },
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_: unknown, record: VPNSubscription) => (
        <Space>
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
          {record.subscription_url && (
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={() => copyToClipboard(record.subscription_url!)}
              title="Копировать ссылку"
            />
          )}
        </Space>
      ),
    },
  ];

  const paymentColumns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 60,
    },
    {
      title: 'Сумма',
      dataIndex: 'amount',
      key: 'amount',
      render: (value: number, record: VPNPayment) => (
        <span style={{ color: '#52c41a', fontWeight: 500 }}>
          {value} {record.currency === 'XTR' ? '⭐' : record.currency}
        </span>
      ),
    },
    {
      title: 'Тариф',
      dataIndex: 'plan_type',
      key: 'plan_type',
      render: (value: string) => <Tag color="blue">{planLabels[value] || value}</Tag>,
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (value: string) => (
        <Tag color={statusColors[value] || 'default'}>
          {statusLabels[value] || value}
        </Tag>
      ),
    },
    {
      title: 'Система',
      dataIndex: 'payment_system',
      key: 'payment_system',
      render: (value: string) => <Tag>{value}</Tag>,
    },
    {
      title: 'Дата',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (value: string) => dayjs(value).format('DD.MM.YYYY HH:mm'),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate('/vpn')}
          style={{ marginBottom: 16 }}
        >
          Назад к подпискам
        </Button>
        <h2 style={{ margin: 0 }}>
          <UserOutlined style={{ marginRight: 8 }} />
          Профиль пользователя
        </h2>
      </div>

      {/* User Info Card */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={24}>
          <Col span={6}>
            <Statistic
              title="Telegram ID"
              value={profile.telegram_id}
              prefix={<UserOutlined />}
            />
            <Button
              type="link"
              size="small"
              href={`https://t.me/user?id=${profile.telegram_id}`}
              target="_blank"
              style={{ padding: 0, marginTop: 4 }}
            >
              Открыть в Telegram
            </Button>
          </Col>
          <Col span={6}>
            <Statistic
              title="Всего потрачено"
              value={profile.total_spent_stars}
              prefix={<StarOutlined style={{ color: '#ffd700' }} />}
              suffix="⭐"
            />
            <div style={{ color: '#888', fontSize: 12 }}>
              ≈ {profile.total_spent_rub} ₽
            </div>
          </Col>
          <Col span={6}>
            <Statistic
              title="Подписок"
              value={profile.total_subscriptions}
              prefix={<SafetyCertificateOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="Платежей"
              value={profile.total_payments}
              prefix={<DollarOutlined />}
            />
          </Col>
        </Row>
      </Card>

      {/* Active Subscription */}
      {profile.active_subscription && (
        <Card
          title={
            <Space>
              <SafetyCertificateOutlined style={{ color: '#52c41a' }} />
              <span>Активная подписка</span>
            </Space>
          }
          style={{ marginBottom: 24 }}
        >
          <Descriptions column={3}>
            <Descriptions.Item label="Тариф">
              <Tag color="blue">{planLabels[profile.active_subscription.plan_type] || profile.active_subscription.plan_type}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Протокол">
              <Tag color={profile.active_subscription.protocol === 'vless' ? 'purple' : 'cyan'}>
                {protocolLabels[profile.active_subscription.protocol] || profile.active_subscription.protocol}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Истекает">
              {profile.active_subscription.expires_at ? (
                <Space>
                  <span>{dayjs(profile.active_subscription.expires_at).format('DD.MM.YYYY')}</span>
                  {profile.active_subscription.days_remaining !== null && (
                    <Tag color={profile.active_subscription.days_remaining <= 3 ? 'red' : 'blue'}>
                      {profile.active_subscription.days_remaining} дн.
                    </Tag>
                  )}
                </Space>
              ) : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Marzban">
              <code>{profile.active_subscription.marzban_username}</code>
            </Descriptions.Item>
            <Descriptions.Item label="Трафик">
              {profile.active_subscription.traffic_limit_gb === 0 ? (
                <Tag color="green">Безлимит</Tag>
              ) : (
                `${profile.active_subscription.traffic_used_gb.toFixed(1)} / ${profile.active_subscription.traffic_limit_gb} GB`
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Создана">
              {dayjs(profile.active_subscription.created_at).format('DD.MM.YYYY HH:mm')}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* Subscriptions Table */}
      <Card
        title={
          <Space>
            <SafetyCertificateOutlined />
            <span>Все подписки ({profile.subscriptions.length})</span>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Table
          dataSource={profile.subscriptions}
          columns={subscriptionColumns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 5 }}
        />
      </Card>

      {/* Payments Table */}
      <Card
        title={
          <Space>
            <DollarOutlined />
            <span>История платежей ({profile.payments.length})</span>
          </Space>
        }
      >
        <Table
          dataSource={profile.payments}
          columns={paymentColumns}
          rowKey="id"
          size="small"
          pagination={{ pageSize: 5 }}
        />
      </Card>
    </div>
  );
};
