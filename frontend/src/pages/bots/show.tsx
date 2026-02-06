import { Show, TagField } from '@refinedev/antd';
import { useShow } from '@refinedev/core';
import { Typography, Descriptions, Space, Button, message } from 'antd';
import { ReloadOutlined, CopyOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';

const { Title } = Typography;

interface Bot {
  id: number;
  name: string;
  username: string | null;
  token_hash: string;
  webhook_url: string | null;
  description: string | null;
  status: 'active' | 'inactive' | 'paused' | 'maintenance' | 'disabled';
  settings: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  users_count: number;
  downloads_count: number;
}

const statusColors: Record<string, string> = {
  active: 'green',
  inactive: 'default',
  paused: 'orange',
  maintenance: 'blue',
  disabled: 'red',
};

export const BotShow = () => {
  const { queryResult } = useShow<Bot>();
  const { data, isLoading } = queryResult;
  const record = data?.data;

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    message.success('Copied to clipboard');
  };

  return (
    <Show isLoading={isLoading}>
      <Title level={5}>Bot Details</Title>

      <Descriptions bordered column={1}>
        <Descriptions.Item label="ID">{record?.id}</Descriptions.Item>
        <Descriptions.Item label="Name">{record?.name}</Descriptions.Item>
        <Descriptions.Item label="Username">
          {record?.username ? `@${record.username}` : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Status">
          <TagField
            color={statusColors[record?.status || 'disabled']}
            value={record?.status?.toUpperCase()}
          />
        </Descriptions.Item>
        <Descriptions.Item label="Пользователей">
          <span style={{ color: '#1890ff', fontWeight: 500 }}>{record?.users_count || 0}</span>
        </Descriptions.Item>
        <Descriptions.Item label="Загрузок">
          <span style={{ color: '#52c41a', fontWeight: 500 }}>{record?.downloads_count || 0}</span>
        </Descriptions.Item>
        <Descriptions.Item label="Token Hash">
          <Space>
            <code>{record?.token_hash}</code>
            <Button
              size="small"
              icon={<CopyOutlined />}
              onClick={() => copyToClipboard(record?.token_hash || '')}
            />
          </Space>
        </Descriptions.Item>
        <Descriptions.Item label="Webhook URL">
          {record?.webhook_url || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Description">
          {record?.description || '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Created">
          {record?.created_at ? dayjs(record.created_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
        </Descriptions.Item>
        <Descriptions.Item label="Updated">
          {record?.updated_at ? dayjs(record.updated_at).format('YYYY-MM-DD HH:mm:ss') : '-'}
        </Descriptions.Item>
      </Descriptions>

      <Space style={{ marginTop: 16 }}>
        <Button type="primary" icon={<ReloadOutlined />}>
          Restart Bot
        </Button>
      </Space>
    </Show>
  );
};
