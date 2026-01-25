import { Edit, useForm } from '@refinedev/antd';
import { Form, Input, Select, DatePicker, InputNumber, Card, Space, Descriptions, Tag, Button, Popconfirm, message } from 'antd';
import { useParams } from 'react-router-dom';
import dayjs from 'dayjs';
import { useState } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

const statusOptions = [
  { label: 'Ожидает', value: 'pending' },
  { label: 'Активна', value: 'active' },
  { label: 'Истекла', value: 'expired' },
  { label: 'Отменена', value: 'cancelled' },
];

const planLabels: Record<string, string> = {
  month_1: '1 месяц',
  month_3: '3 месяца',
  year_1: '12 месяцев',
};

const protocolLabels: Record<string, string> = {
  vless: 'VLESS Reality',
  shadowsocks: 'Outline',
};

export const VPNEdit = () => {
  const { id } = useParams();
  const [extending, setExtending] = useState(false);

  const { formProps, saveButtonProps, queryResult } = useForm({
    resource: 'vpn/subscriptions',
    id,
    redirect: 'list',
  });

  const record = queryResult?.data?.data;

  const handleExtend = async (days: number) => {
    setExtending(true);
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
        queryResult?.refetch();
      } else {
        message.error('Ошибка при продлении');
      }
    } catch (error) {
      message.error('Ошибка при продлении');
    } finally {
      setExtending(false);
    }
  };

  return (
    <Edit
      saveButtonProps={saveButtonProps}
      title="Редактирование VPN подписки"
    >
      {/* Read-only info */}
      {record && (
        <Card title="Информация о подписке" style={{ marginBottom: 24 }}>
          <Descriptions column={2}>
            <Descriptions.Item label="Telegram ID">
              <a
                href={`https://t.me/user?id=${record.telegram_id}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                {record.telegram_id}
              </a>
            </Descriptions.Item>
            <Descriptions.Item label="Marzban Username">
              <code>{record.marzban_username}</code>
            </Descriptions.Item>
            <Descriptions.Item label="Тариф">
              <Tag color="blue">{planLabels[record.plan_type] || record.plan_type}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Протокол">
              <Tag color={record.protocol === 'vless' ? 'purple' : 'cyan'}>
                {protocolLabels[record.protocol] || record.protocol}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Трафик использовано">
              {record.traffic_used_gb?.toFixed(1) || 0} GB
            </Descriptions.Item>
            <Descriptions.Item label="Создана">
              {dayjs(record.created_at).format('DD.MM.YYYY HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="Subscription URL" span={2}>
              {record.subscription_url ? (
                <code style={{ fontSize: 11, wordBreak: 'break-all' }}>
                  {record.subscription_url}
                </code>
              ) : (
                <span style={{ color: '#888' }}>—</span>
              )}
            </Descriptions.Item>
          </Descriptions>
        </Card>
      )}

      {/* Quick actions */}
      <Card title="Быстрые действия" style={{ marginBottom: 24 }}>
        <Space>
          <Popconfirm
            title="Продлить на 7 дней?"
            onConfirm={() => handleExtend(7)}
            okText="Да"
            cancelText="Нет"
          >
            <Button loading={extending}>+7 дней</Button>
          </Popconfirm>
          <Popconfirm
            title="Продлить на 30 дней?"
            onConfirm={() => handleExtend(30)}
            okText="Да"
            cancelText="Нет"
          >
            <Button loading={extending} type="primary">+30 дней</Button>
          </Popconfirm>
          <Popconfirm
            title="Продлить на 90 дней?"
            onConfirm={() => handleExtend(90)}
            okText="Да"
            cancelText="Нет"
          >
            <Button loading={extending}>+90 дней</Button>
          </Popconfirm>
        </Space>
      </Card>

      {/* Editable fields */}
      <Card title="Редактировать">
        <Form {...formProps} layout="vertical">
          <Form.Item
            label="Статус"
            name="status"
          >
            <Select options={statusOptions} style={{ width: 200 }} />
          </Form.Item>

          <Form.Item
            label="Лимит трафика (GB)"
            name="traffic_limit_gb"
          >
            <InputNumber min={0} style={{ width: 200 }} />
          </Form.Item>

          <Form.Item
            label="Дата истечения"
            name="expires_at"
            getValueProps={(value) => ({
              value: value ? dayjs(value) : null,
            })}
            getValueFromEvent={(date) => date?.toISOString()}
          >
            <DatePicker
              showTime
              format="DD.MM.YYYY HH:mm"
              style={{ width: 200 }}
            />
          </Form.Item>
        </Form>
      </Card>
    </Edit>
  );
};
