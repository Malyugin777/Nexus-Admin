import {
  List,
  useTable,
  EditButton,
  DeleteButton,
  CreateButton,
  TagField,
} from '@refinedev/antd';
import { Table, Space, Button, Card, Row, Col, Statistic, Tooltip, Typography, Divider } from 'antd';
import {
  ReloadOutlined,
  DollarOutlined,
  CalendarOutlined,
  LinkOutlined,
  ClockCircleOutlined,
  CloudServerOutlined,
  GlobalOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { ExportButton } from '../../components';

interface Subscription {
  id: number;
  name: string;
  description: string | null;
  provider: string;
  provider_url: string | null;
  ip_address: string | null;
  category: string;
  amount: number;
  currency: string;
  billing_cycle: string;
  next_payment_date: string | null;
  auto_renew: boolean;
  notify_days: number[];
  status: string;
  created_at: string;
  updated_at: string;
  days_until_payment: number | null;
}

const statusColors: Record<string, string> = {
  active: 'green', ACTIVE: 'green',
  cancelled: 'orange', CANCELLED: 'orange',
  expired: 'red', EXPIRED: 'red',
};

const providerColors: Record<string, string> = {
  aeza: '#00a86b', AEZA: '#00a86b',
  hostkey: '#1890ff', HOSTKEY: '#1890ff',
  rapidapi: '#0055ff', RAPIDAPI: '#0055ff',
  domain: '#722ed1', DOMAIN: '#722ed1',
  regru: '#e53935', REGRU: '#e53935',
  github: '#24292e', GITHUB: '#24292e',
  other: 'default', OTHER: 'default',
};

const providerLabels: Record<string, string> = {
  aeza: 'Aeza', AEZA: 'Aeza',
  hostkey: 'Hostkey', HOSTKEY: 'Hostkey',
  rapidapi: 'RapidAPI', RAPIDAPI: 'RapidAPI',
  domain: 'Regway', DOMAIN: 'Regway',
  regru: 'Reg.ru', REGRU: 'Reg.ru',
  github: 'GitHub', GITHUB: 'GitHub',
  other: 'Другое', OTHER: 'Другое',
};

const cycleLabels: Record<string, string> = {
  monthly: '/мес', MONTHLY: '/мес',
  yearly: '/год', YEARLY: '/год',
  usage: '/исп', USAGE: '/исп',
};

const categoryConfig: Record<string, { icon: React.ReactNode; title: string; color: string }> = {
  domain: { icon: <GlobalOutlined />, title: 'Домены', color: '#722ed1' },
  infrastructure: { icon: <CloudServerOutlined />, title: 'Инфраструктура', color: '#1890ff' },
  operational: { icon: <ApiOutlined />, title: 'Рабочие сервисы', color: '#fa8c16' },
};

const SubscriptionTable = ({ data, showIP = true }: { data: Subscription[]; showIP?: boolean }) => (
  <Table dataSource={data} rowKey="id" pagination={false} size="small">
    <Table.Column
      dataIndex="name"
      title="Название"
      render={(value: string, record: Subscription) => (
        <Space direction="vertical" size={0}>
          <strong>{value}</strong>
          {record.description && (
            <span style={{ fontSize: 11, color: '#a0a0a0' }}>{record.description}</span>
          )}
        </Space>
      )}
    />
    {showIP && (
      <Table.Column
        dataIndex="ip_address"
        title="IP"
        width={130}
        render={(value: string | null) =>
          value ? <code style={{ fontSize: 12 }}>{value}</code> : <span style={{ color: '#a0a0a0' }}>—</span>
        }
      />
    )}
    <Table.Column
      dataIndex="provider"
      title="Провайдер"
      width={100}
      render={(value: string, record: Subscription) => (
        <Space>
          <TagField color={providerColors[value] || 'default'} value={providerLabels[value] || value} />
          {record.provider_url && (
            <Tooltip title="Открыть ЛК">
              <a href={record.provider_url} target="_blank" rel="noopener noreferrer">
                <LinkOutlined />
              </a>
            </Tooltip>
          )}
        </Space>
      )}
    />
    <Table.Column
      dataIndex="amount"
      title="Цена"
      width={100}
      render={(value: number, record: Subscription) => (
        <span style={{ fontWeight: 500 }}>
          {value.toLocaleString()} {record.currency === 'RUB' ? '₽' : record.currency}
          <span style={{ fontSize: 11, color: '#a0a0a0' }}>
            {cycleLabels[record.billing_cycle] || ''}
          </span>
        </span>
      )}
    />
    <Table.Column
      dataIndex="next_payment_date"
      title="Платёж"
      width={110}
      render={(value: string | null, record: Subscription) => {
        if (!value) return <span style={{ color: '#a0a0a0' }}>—</span>;
        const days = record.days_until_payment;
        let color = '#888';
        if (days !== null) {
          if (days <= 1) color = '#ff4d4f';
          else if (days <= 3) color = '#faad14';
          else if (days <= 7) color = '#1890ff';
        }
        return (
          <Space direction="vertical" size={0}>
            <span>{dayjs(value).format('DD.MM.YYYY')}</span>
            {days !== null && (
              <span style={{ fontSize: 11, color }}>
                {days === 0 ? 'Сегодня!' : days === 1 ? 'Завтра' : `${days} дн.`}
              </span>
            )}
          </Space>
        );
      }}
    />
    <Table.Column
      dataIndex="status"
      title="Статус"
      width={90}
      render={(value: string) => {
        const v = value?.toUpperCase();
        return (
          <TagField
            color={statusColors[value] || 'default'}
            value={v === 'ACTIVE' ? 'Активна' : v === 'CANCELLED' ? 'Отменена' : 'Истекла'}
          />
        );
      }}
    />
    <Table.Column
      title=""
      width={80}
      render={(_, record: Subscription) => (
        <Space>
          <EditButton hideText size="small" recordItemId={record.id} />
          <DeleteButton hideText size="small" recordItemId={record.id} />
        </Space>
      )}
    />
  </Table>
);

export const SubscriptionList = () => {
  const { tableQueryResult } = useTable<Subscription>({
    resource: 'subscriptions',
    syncWithLocation: false,
    pagination: { mode: 'off' },
  });

  const data = tableQueryResult.data?.data || [];
  const activeSubscriptions = data.filter((s) => s.status === 'active' || s.status === 'ACTIVE');

  // Calculate monthly total (convert EUR to RUB ~100)
  const monthlyTotal = activeSubscriptions
    .filter((s) => s.billing_cycle === 'monthly' || s.billing_cycle === 'MONTHLY')
    .reduce((sum, s) => {
      if (s.currency === 'RUB') return sum + s.amount;
      if (s.currency === 'EUR') return sum + s.amount * 100;
      if (s.currency === 'USD') return sum + s.amount * 90;
      return sum + s.amount;
    }, 0);

  const upcomingPayments = activeSubscriptions.filter(
    (s) => s.days_until_payment !== null && s.days_until_payment <= 7
  );

  // Group by category
  const domains = data.filter((s) => s.category === 'domain');
  const infrastructure = data.filter((s) => s.category === 'infrastructure');
  const operational = data.filter((s) => s.category === 'operational');

  return (
    <List
      headerButtons={({ createButtonProps }) => (
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => tableQueryResult.refetch()}>
            Обновить
          </Button>
          <ExportButton resource="subscriptions" />
          <CreateButton {...createButtonProps} />
        </Space>
      )}
    >
      {/* Stats Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Активных"
              value={activeSubscriptions.length}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Ежемесячно"
              value={monthlyTotal}
              prefix={<DollarOutlined />}
              precision={0}
              suffix="₽"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Платежей на неделе"
              value={upcomingPayments.length}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: upcomingPayments.length > 0 ? '#faad14' : undefined }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic title="Всего" value={data.length} />
          </Card>
        </Col>
      </Row>

      {/* Domains Section */}
      {domains.length > 0 && (
        <Card
          title={
            <Space>
              <GlobalOutlined style={{ color: categoryConfig.domain.color }} />
              <span>Домены</span>
              <TagField color="purple" value={`${domains.length}`} />
            </Space>
          }
          style={{ marginBottom: 0 }}
          size="small"
        >
          <SubscriptionTable data={domains} showIP={false} />
        </Card>
      )}

      {/* Divider */}
      {domains.length > 0 && infrastructure.length > 0 && (
        <Divider style={{ margin: '16px 0' }} />
      )}

      {/* Infrastructure Section */}
      {infrastructure.length > 0 && (
        <Card
          title={
            <Space>
              <CloudServerOutlined style={{ color: categoryConfig.infrastructure.color }} />
              <span>Инфраструктура</span>
              <TagField color="blue" value={`${infrastructure.length}`} />
            </Space>
          }
          style={{ marginBottom: 0 }}
          size="small"
        >
          <SubscriptionTable data={infrastructure} />
        </Card>
      )}

      {/* Divider */}
      {infrastructure.length > 0 && operational.length > 0 && (
        <Divider style={{ margin: '16px 0' }} />
      )}

      {/* Operational Section */}
      {operational.length > 0 && (
        <Card
          title={
            <Space>
              <ApiOutlined style={{ color: categoryConfig.operational.color }} />
              <span>Рабочие сервисы</span>
              <TagField color="orange" value={`${operational.length}`} />
            </Space>
          }
          size="small"
        >
          <SubscriptionTable data={operational} />
        </Card>
      )}
    </List>
  );
};
