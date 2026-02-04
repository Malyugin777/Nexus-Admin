import {
  List,
  useTable,
  EditButton,
  DeleteButton,
  CreateButton,
  TagField,
} from '@refinedev/antd';
import { Table, Space, Button, Card, Row, Col, Statistic, Tooltip, Typography } from 'antd';
import {
  ReloadOutlined,
  DollarOutlined,
  CalendarOutlined,
  LinkOutlined,
  ClockCircleOutlined,
  CloudServerOutlined,
  SafetyCertificateOutlined,
  GlobalOutlined,
  ApiOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { ExportButton } from '../../components';

const { Title } = Typography;

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
  github: '#24292e', GITHUB: '#24292e',
  other: 'default', OTHER: 'default',
};

const providerLabels: Record<string, string> = {
  aeza: 'Aeza', AEZA: 'Aeza',
  hostkey: 'Hostkey', HOSTKEY: 'Hostkey',
  rapidapi: 'RapidAPI', RAPIDAPI: 'RapidAPI',
  domain: 'Regway', DOMAIN: 'Regway',
  github: 'GitHub', GITHUB: 'GitHub',
  other: 'Другое', OTHER: 'Другое',
};

const cycleLabels: Record<string, string> = {
  monthly: '/мес', MONTHLY: '/мес',
  yearly: '/год', YEARLY: '/год',
  usage: '/исп', USAGE: '/исп',
};

const categoryConfig: Record<string, { icon: React.ReactNode; title: string; color: string }> = {
  infrastructure: { icon: <CloudServerOutlined />, title: 'Инфраструктура', color: '#1890ff' },
  vpn: { icon: <SafetyCertificateOutlined />, title: 'VPN Узлы', color: '#52c41a' },
  domain: { icon: <GlobalOutlined />, title: 'Домены', color: '#722ed1' },
  api: { icon: <ApiOutlined />, title: 'API Сервисы', color: '#fa8c16' },
  other: { icon: <CloudServerOutlined />, title: 'Прочее', color: '#8c8c8c' },
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
            <span style={{ fontSize: 11, color: '#888' }}>{record.description}</span>
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
          value ? <code style={{ fontSize: 12 }}>{value}</code> : <span style={{ color: '#888' }}>—</span>
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
          <span style={{ fontSize: 11, color: '#888' }}>
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
        if (!value) return <span style={{ color: '#888' }}>—</span>;
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
  const infrastructure = data.filter((s) => s.category === 'infrastructure');
  const vpn = data.filter((s) => s.category === 'vpn');
  const domains = data.filter((s) => s.category === 'domain');
  const api = data.filter((s) => s.category === 'api');
  const other = data.filter((s) => !['infrastructure', 'vpn', 'domain', 'api'].includes(s.category));

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
          style={{ marginBottom: 16 }}
          size="small"
        >
          <SubscriptionTable data={infrastructure} />
        </Card>
      )}

      {/* VPN Section */}
      {vpn.length > 0 && (
        <Card
          title={
            <Space>
              <SafetyCertificateOutlined style={{ color: categoryConfig.vpn.color }} />
              <span>VPN Узлы</span>
              <TagField color="green" value={`${vpn.length}`} />
            </Space>
          }
          style={{ marginBottom: 16 }}
          size="small"
        >
          <SubscriptionTable data={vpn} />
        </Card>
      )}

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
          style={{ marginBottom: 16 }}
          size="small"
        >
          <SubscriptionTable data={domains} showIP={false} />
        </Card>
      )}

      {/* API Section */}
      {api.length > 0 && (
        <Card
          title={
            <Space>
              <ApiOutlined style={{ color: categoryConfig.api.color }} />
              <span>API Сервисы</span>
              <TagField color="orange" value={`${api.length}`} />
            </Space>
          }
          style={{ marginBottom: 16 }}
          size="small"
        >
          <SubscriptionTable data={api} showIP={false} />
        </Card>
      )}

      {/* Other Section */}
      {other.length > 0 && (
        <Card
          title={
            <Space>
              <CloudServerOutlined style={{ color: categoryConfig.other.color }} />
              <span>Прочее</span>
              <TagField color="default" value={`${other.length}`} />
            </Space>
          }
          size="small"
        >
          <SubscriptionTable data={other} />
        </Card>
      )}
    </List>
  );
};
