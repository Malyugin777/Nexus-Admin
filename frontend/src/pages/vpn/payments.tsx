import {
  List,
  useTable,
  TagField,
} from '@refinedev/antd';
import { Table, Space, Select, Button, Card, Row, Col, Statistic } from 'antd';
import {
  ReloadOutlined,
  DollarOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import dayjs from 'dayjs';
import { ExportButton } from '../../components';

interface VPNPayment {
  id: number;
  telegram_id: number;
  amount: number;
  currency: string;
  payment_system: string;
  payment_id: string | null;
  plan_type: string;
  status: string;
  created_at: string;
  completed_at: string | null;
  subscription_id: number | null;
}

const statusColors: Record<string, string> = {
  pending: 'orange',
  completed: 'green',
  failed: 'red',
  refunded: 'default',
};

const statusLabels: Record<string, string> = {
  pending: 'Ожидает',
  completed: 'Успешно',
  failed: 'Ошибка',
  refunded: 'Возврат',
};

const planLabels: Record<string, string> = {
  month_1: '1 мес',
  month_3: '3 мес',
  year_1: '12 мес',
};

const systemLabels: Record<string, string> = {
  telegram_stars: 'Telegram Stars',
  yookassa: 'YooKassa',
};

export const VPNPayments = () => {
  const [statusFilter, setStatusFilter] = useState<string | undefined>();

  const { tableProps, tableQueryResult } = useTable<VPNPayment>({
    resource: 'vpn/payments',
    syncWithLocation: true,
    filters: {
      permanent: [
        ...(statusFilter ? [{ field: 'status_filter', operator: 'eq' as const, value: statusFilter }] : []),
      ],
    },
  });

  // Calculate totals from data
  const data = tableQueryResult.data?.data || [];
  const completedPayments = data.filter((p: VPNPayment) => p.status === 'completed');
  const totalStars = completedPayments.reduce((sum: number, p: VPNPayment) => sum + p.amount, 0);
  const pendingPayments = data.filter((p: VPNPayment) => p.status === 'pending');

  return (
    <List
      title="VPN Платежи"
      headerButtons={() => (
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={() => tableQueryResult.refetch()}
          >
            Обновить
          </Button>
          <ExportButton resource="vpn/payments" />
        </Space>
      )}
    >
      {/* Stats Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Успешных платежей"
              value={completedPayments.length}
              prefix={<CheckCircleOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Сумма (Stars)"
              value={totalStars}
              prefix={<DollarOutlined />}
              suffix="⭐"
            />
            <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
              ~{totalStars * 2} ₽
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Ожидающих"
              value={pendingPayments.length}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: pendingPayments.length > 0 ? '#faad14' : undefined }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Всего платежей"
              value={data.length}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Space style={{ marginBottom: 16 }}>
        <Select
          placeholder="Статус"
          style={{ width: 150 }}
          allowClear
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { label: 'Успешные', value: 'completed' },
            { label: 'Ожидающие', value: 'pending' },
            { label: 'Ошибки', value: 'failed' },
            { label: 'Возвраты', value: 'refunded' },
          ]}
        />
      </Space>

      <Table {...tableProps} rowKey="id" size="middle">
        <Table.Column
          dataIndex="id"
          title="ID"
          width={80}
        />
        <Table.Column
          dataIndex="telegram_id"
          title="Telegram ID"
          render={(value: number) => (
            <a
              href={`https://t.me/user?id=${value}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              {value}
            </a>
          )}
        />
        <Table.Column
          dataIndex="amount"
          title="Сумма"
          render={(value: number, record: VPNPayment) => (
            <span style={{ fontWeight: 500 }}>
              {value} {record.currency === 'XTR' ? '⭐' : record.currency}
            </span>
          )}
        />
        <Table.Column
          dataIndex="payment_system"
          title="Система"
          render={(value: string) => (
            <TagField
              color={value === 'telegram_stars' ? 'blue' : 'green'}
              value={systemLabels[value] || value}
            />
          )}
        />
        <Table.Column
          dataIndex="plan_type"
          title="Тариф"
          render={(value: string) => planLabels[value] || value}
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
          dataIndex="created_at"
          title="Дата"
          render={(value: string) => dayjs(value).format('DD.MM.YYYY HH:mm')}
        />
        <Table.Column
          dataIndex="payment_id"
          title="Payment ID"
          render={(value: string | null) => (
            value ? (
              <code style={{ fontSize: 11 }}>{value.slice(0, 16)}...</code>
            ) : (
              <span style={{ color: '#888' }}>—</span>
            )
          )}
        />
      </Table>
    </List>
  );
};
