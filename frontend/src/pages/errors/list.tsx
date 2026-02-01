import { List, useTable, TagField } from '@refinedev/antd';
import { useCustom } from '@refinedev/core';
import { Table, Card, Row, Col, Statistic, Select, Space, Button } from 'antd';
import { ReloadOutlined, WarningOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useState } from 'react';
import { ExportButton } from '../../components';

interface DownloadError {
  id: number;
  user_id: number | null;
  bot_id: number | null;
  platform: string;
  url: string;
  error_type: string;
  error_message: string | null;
  error_details: Record<string, unknown> | null;
  created_at: string;
}

interface ErrorStats {
  total_errors: number;
  errors_today: number;
  errors_by_platform: Record<string, number>;
  errors_by_type: Record<string, number>;
}

interface Bot {
  id: number;
  name: string;
}

const platformColors: Record<string, string> = {
  instagram: 'magenta',
  tiktok: 'cyan',
  youtube: 'red',
  pinterest: 'volcano',
  vk_music: 'blue',
  yandex_music: 'gold',
  youtube_music: 'red',
  deezer: 'purple',
  unknown: 'default',
};

const errorTypeColors: Record<string, string> = {
  download_failed: 'orange',
  exception: 'red',
  timeout: 'gold',
  network: 'blue',
};

export const ErrorList = () => {
  const [platformFilter, setPlatformFilter] = useState<string | undefined>();
  const [typeFilter, setTypeFilter] = useState<string | undefined>();
  const [botFilter, setBotFilter] = useState<number | undefined>();

  // Fetch bots for filter dropdown
  const { data: botsData } = useCustom<{ data: Bot[] }>({
    url: '/bots',
    method: 'get',
    config: { query: { page_size: 100 } },
  });

  // Fetch dynamic platform list
  const { data: platformsData } = useCustom<{ platforms: string[] }>({
    url: '/errors/platforms',
    method: 'get',
  });

  // Fetch dynamic error type list
  const { data: typesData } = useCustom<{ types: string[] }>({
    url: '/errors/types',
    method: 'get',
  });

  const { tableProps, tableQueryResult } = useTable<DownloadError>({
    resource: 'errors',
    syncWithLocation: true,
    filters: {
      permanent: [
        ...(platformFilter ? [{ field: 'platform', operator: 'eq' as const, value: platformFilter }] : []),
        ...(typeFilter ? [{ field: 'error_type', operator: 'eq' as const, value: typeFilter }] : []),
        ...(botFilter ? [{ field: 'bot_id', operator: 'eq' as const, value: botFilter }] : []),
      ],
    },
  });

  const { data: statsData } = useCustom<ErrorStats>({
    url: '/errors/stats',
    method: 'get',
    config: {
      query: {
        ...(botFilter && { bot_id: botFilter }),
      },
    },
    queryOptions: {
      queryKey: ['error-stats', botFilter],
    },
  });

  const stats = statsData?.data;
  const bots = botsData?.data?.data || [];
  const platforms = platformsData?.data?.platforms || [];
  const errorTypes = typesData?.data?.types || [];

  return (
    <List
      title="Ошибки"
      headerButtons={
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => tableQueryResult.refetch()}>
            Обновить
          </Button>
          <ExportButton
            resource="errors"
            filters={{ platform: platformFilter, error_type: typeFilter, bot_id: botFilter }}
          />
        </Space>
      }
    >
      {/* Stats Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Всего ошибок"
              value={stats?.total_errors || 0}
              prefix={<WarningOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Сегодня"
              value={stats?.errors_today || 0}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        {Object.entries(stats?.errors_by_platform || {})
          .sort(([, a], [, b]) => b - a)
          .slice(0, 2)
          .map(([platform, count]) => (
            <Col span={6} key={platform}>
              <Card>
                <Statistic
                  title={platform.charAt(0).toUpperCase() + platform.slice(1)}
                  value={count}
                  valueStyle={{ color: '#eb2f96' }}
                />
              </Card>
            </Col>
          ))}
      </Row>

      {/* Filters */}
      <Space style={{ marginBottom: 16 }} wrap>
        <Select
          placeholder="Бот"
          style={{ width: 150 }}
          allowClear
          value={botFilter}
          onChange={setBotFilter}
          options={bots.map((bot) => ({
            label: bot.name,
            value: bot.id,
          }))}
        />
        <Select
          placeholder="Платформа"
          style={{ width: 150 }}
          allowClear
          value={platformFilter}
          onChange={setPlatformFilter}
          options={platforms.map((p) => ({
            label: p.charAt(0).toUpperCase() + p.slice(1),
            value: p,
          }))}
        />
        <Select
          placeholder="Тип ошибки"
          style={{ width: 150 }}
          allowClear
          value={typeFilter}
          onChange={setTypeFilter}
          options={errorTypes.map((t) => ({
            label: t,
            value: t,
          }))}
        />
      </Space>

      <Table {...tableProps} rowKey="id" scroll={{ x: true }}>
        <Table.Column dataIndex="id" title="ID" width={60} />
        <Table.Column
          dataIndex="platform"
          title="Платформа"
          width={100}
          render={(value: string) => (
            <TagField color={platformColors[value] || 'default'} value={value} />
          )}
        />
        <Table.Column
          dataIndex="error_type"
          title="Тип"
          width={120}
          render={(value: string) => (
            <TagField color={errorTypeColors[value] || 'default'} value={value} />
          )}
        />
        <Table.Column
          dataIndex="error_message"
          title="Сообщение"
          ellipsis
          render={(value: string | null) => value || '-'}
        />
        <Table.Column
          dataIndex="url"
          title="URL"
          width={200}
          ellipsis
          render={(value: string) => value ? (
            <a href={value} target="_blank" rel="noopener noreferrer">
              {value.substring(0, 40)}...
            </a>
          ) : '—'}
        />
        <Table.Column
          dataIndex="created_at"
          title="Время"
          width={130}
          render={(value: string) => dayjs(value).format('DD.MM.YY HH:mm')}
        />
      </Table>
    </List>
  );
};
