import { List } from '@refinedev/antd';
import { useCustom } from '@refinedev/core';
import {
  Table,
  Space,
  Button,
  Card,
  Row,
  Col,
  Statistic,
  Tag,
  Popconfirm,
  message,
  Modal,
  Form,
  Input,
  InputNumber,
  Tabs,
  Progress,
  Typography,
  Tooltip,
} from 'antd';
import {
  ReloadOutlined,
  PlusOutlined,
  TagOutlined,
  CopyOutlined,
  DownloadOutlined,
  DeleteOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  GiftOutlined,
} from '@ant-design/icons';
import { useState } from 'react';
import dayjs from 'dayjs';

const { Text } = Typography;

// ============ Interfaces ============

interface PromoStats {
  total_codes: number;
  active_codes: number;
  total_activations: number;
  batches_count: number;
}

interface PromoBatch {
  batch_id: string;
  campaign_name: string | null;
  codes_count: number;
  total_activations: number;
  active_codes: number;
  created_at: string;
}

interface PromoCode {
  id: number;
  code: string;
  batch_id: string | null;
  campaign_name: string | null;
  days: number;
  traffic_gb: number;
  max_activations: number;
  current_activations: number;
  active: boolean;
  created_at: string;
}

interface GenerateResponse {
  batch_id: string;
  codes: string[];
  count: number;
  campaign_name: string;
}

// ============ Constants ============

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

// ============ Component ============

export const PromocodeList = () => {
  // State
  const [activeTab, setActiveTab] = useState<string>('batches');
  const [selectedBatchId, setSelectedBatchId] = useState<string | null>(null);
  const [generateModalOpen, setGenerateModalOpen] = useState(false);
  const [generateLoading, setGenerateLoading] = useState(false);
  const [generatedResult, setGeneratedResult] = useState<GenerateResponse | null>(null);
  const [generateForm] = Form.useForm();

  // Data fetching
  const { data: statsData, refetch: refetchStats } = useCustom<PromoStats>({
    url: '/promo/stats',
    method: 'get',
  });

  const { data: batchesData, refetch: refetchBatches, isLoading: batchesLoading } = useCustom<PromoBatch[]>({
    url: '/promo/batches',
    method: 'get',
  });

  const { data: codesData, refetch: refetchCodes, isLoading: codesLoading } = useCustom<PromoCode[]>({
    url: '/promo/codes',
    method: 'get',
    config: {
      query: selectedBatchId ? { batch_id: selectedBatchId } : {},
    },
  });

  const stats = statsData?.data;
  const batches = batchesData?.data || [];
  const codes = codesData?.data || [];

  // Handlers
  const handleRefresh = () => {
    refetchStats();
    refetchBatches();
    refetchCodes();
  };

  const handleGenerate = async (values: {
    campaign_name: string;
    prefix: string;
    count: number;
    days: number;
    traffic_gb: number;
    max_activations: number;
  }) => {
    setGenerateLoading(true);
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/promo/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || 'Generation failed');
      }

      const result: GenerateResponse = await response.json();
      setGeneratedResult(result);
      message.success(`Создано ${result.count} кодов`);
      handleRefresh();
    } catch (error) {
      message.error(`Ошибка: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setGenerateLoading(false);
    }
  };

  const handleRevokeBatch = async (batchId: string) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/promo/batch/${batchId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        message.success(`Отозвано ${result.revoked_count} кодов`);
        handleRefresh();
      } else {
        message.error('Ошибка при отзыве');
      }
    } catch {
      message.error('Ошибка при отзыве');
    }
  };

  const handleRevokeCode = async (code: string) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/promo/code/${code}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      if (response.ok) {
        message.success('Код отозван');
        handleRefresh();
      } else {
        message.error('Ошибка при отзыве');
      }
    } catch {
      message.error('Ошибка при отзыве');
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    message.success('Код скопирован');
  };

  const handleCopyAllCodes = (codesList: string[]) => {
    navigator.clipboard.writeText(codesList.join('\n'));
    message.success(`Скопировано ${codesList.length} кодов`);
  };

  const handleDownloadCSV = (result: GenerateResponse) => {
    const csvContent = [
      'code,campaign_name,batch_id',
      ...result.codes.map(code => `${code},${result.campaign_name},${result.batch_id}`),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `promo_${result.batch_id}_${result.campaign_name.replace(/\s+/g, '_')}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    message.success('CSV скачан');
  };

  const handleViewBatchCodes = (batchId: string) => {
    setSelectedBatchId(batchId);
    setActiveTab('codes');
  };

  const handleCloseModal = () => {
    setGenerateModalOpen(false);
    setGeneratedResult(null);
    generateForm.resetFields();
  };

  // Columns for batches table
  const batchColumns = [
    {
      title: 'Batch ID',
      dataIndex: 'batch_id',
      key: 'batch_id',
      render: (value: string) => (
        <Tag color="blue">{value}</Tag>
      ),
    },
    {
      title: 'Кампания',
      dataIndex: 'campaign_name',
      key: 'campaign_name',
      render: (value: string | null) => value || '-',
    },
    {
      title: 'Создан',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (value: string) => dayjs(value).format('DD.MM.YYYY HH:mm'),
    },
    {
      title: 'Кодов',
      dataIndex: 'codes_count',
      key: 'codes_count',
    },
    {
      title: 'Активаций',
      key: 'activations',
      render: (_: unknown, record: PromoBatch) => (
        <Space>
          <Progress
            percent={Math.round((record.total_activations / record.codes_count) * 100)}
            size="small"
            style={{ width: 80 }}
            format={() => `${record.total_activations}/${record.codes_count}`}
          />
        </Space>
      ),
    },
    {
      title: 'Активных',
      dataIndex: 'active_codes',
      key: 'active_codes',
      render: (value: number, record: PromoBatch) => (
        <Tag color={value === record.codes_count ? 'green' : value === 0 ? 'red' : 'orange'}>
          {value}
        </Tag>
      ),
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_: unknown, record: PromoBatch) => (
        <Space>
          <Tooltip title="Посмотреть коды">
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => handleViewBatchCodes(record.batch_id)}
            />
          </Tooltip>
          <Popconfirm
            title="Отозвать все коды в этом батче?"
            description="Коды станут неактивными"
            onConfirm={() => handleRevokeBatch(record.batch_id)}
            okText="Да"
            cancelText="Нет"
          >
            <Tooltip title="Отозвать батч">
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // Columns for codes table
  const codeColumns = [
    {
      title: 'Код',
      dataIndex: 'code',
      key: 'code',
      render: (value: string) => (
        <Space>
          <Text code copyable={{ text: value }}>{value}</Text>
        </Space>
      ),
    },
    {
      title: 'Batch',
      dataIndex: 'batch_id',
      key: 'batch_id',
      render: (value: string | null) => value ? <Tag color="blue">{value}</Tag> : '-',
    },
    {
      title: 'Кампания',
      dataIndex: 'campaign_name',
      key: 'campaign_name',
      render: (value: string | null) => value || '-',
    },
    {
      title: 'Дней',
      dataIndex: 'days',
      key: 'days',
    },
    {
      title: 'Трафик',
      dataIndex: 'traffic_gb',
      key: 'traffic_gb',
      render: (value: number) => value === 0 ? 'Безлимит' : `${value} GB`,
    },
    {
      title: 'Активаций',
      key: 'activations',
      render: (_: unknown, record: PromoCode) => (
        <Tag color={record.current_activations >= record.max_activations ? 'red' : 'green'}>
          {record.current_activations}/{record.max_activations}
        </Tag>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'active',
      key: 'active',
      render: (value: boolean) => (
        <Tag color={value ? 'green' : 'red'}>
          {value ? 'Активен' : 'Отозван'}
        </Tag>
      ),
    },
    {
      title: 'Создан',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (value: string) => dayjs(value).format('DD.MM.YY'),
    },
    {
      title: '',
      key: 'actions',
      width: 50,
      render: (_: unknown, record: PromoCode) => (
        record.active && (
          <Popconfirm
            title="Отозвать код?"
            onConfirm={() => handleRevokeCode(record.code)}
            okText="Да"
            cancelText="Нет"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        )
      ),
    },
  ];

  return (
    <List
      title="Промокоды"
      headerButtons={() => (
        <Space>
          <Button icon={<ReloadOutlined />} onClick={handleRefresh}>
            Обновить
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setGenerateModalOpen(true)}>
            Создать батч
          </Button>
        </Space>
      )}
    >
      {/* Stats Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Всего кодов"
              value={stats?.total_codes || 0}
              prefix={<TagOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Активных"
              value={stats?.active_codes || 0}
              valueStyle={{ color: '#3f8600' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Активаций"
              value={stats?.total_activations || 0}
              prefix={<GiftOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Батчей"
              value={stats?.batches_count || 0}
              prefix={<TagOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Tabs */}
      <Tabs
        activeKey={activeTab}
        onChange={(key) => {
          setActiveTab(key);
          if (key === 'batches') {
            setSelectedBatchId(null);
          }
        }}
        items={[
          {
            key: 'batches',
            label: 'Батчи',
            children: (
              <Table
                dataSource={batches}
                columns={batchColumns}
                rowKey="batch_id"
                loading={batchesLoading}
                size="middle"
                pagination={{ pageSize: 10 }}
              />
            ),
          },
          {
            key: 'codes',
            label: selectedBatchId ? `Коды (${selectedBatchId})` : 'Все коды',
            children: (
              <>
                {selectedBatchId && (
                  <Space style={{ marginBottom: 16 }}>
                    <Button onClick={() => setSelectedBatchId(null)}>
                      Показать все коды
                    </Button>
                    <Tag color="blue">Фильтр: {selectedBatchId}</Tag>
                  </Space>
                )}
                <Table
                  dataSource={codes}
                  columns={codeColumns}
                  rowKey="id"
                  loading={codesLoading}
                  size="middle"
                  pagination={{ pageSize: 20 }}
                />
              </>
            ),
          },
        ]}
      />

      {/* Generate Modal */}
      <Modal
        title={generatedResult ? 'Коды созданы' : 'Создать батч промокодов'}
        open={generateModalOpen}
        onCancel={handleCloseModal}
        footer={null}
        width={500}
        destroyOnClose
      >
        {!generatedResult ? (
          <Form
            form={generateForm}
            layout="vertical"
            onFinish={handleGenerate}
            initialValues={{
              count: 10,
              days: 30,
              traffic_gb: 100,
              max_activations: 1,
            }}
          >
            <Form.Item
              name="campaign_name"
              label="Название кампании"
              rules={[{ required: true, message: 'Введите название' }]}
            >
              <Input placeholder="Instagram Promo Q1" />
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="prefix"
                  label="Префикс кода"
                  rules={[
                    { required: true, message: 'Введите префикс' },
                    { min: 2, max: 10, message: '2-10 символов' },
                  ]}
                >
                  <Input placeholder="INSTA" style={{ textTransform: 'uppercase' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="count"
                  label="Количество"
                  rules={[{ required: true, message: 'Введите количество' }]}
                >
                  <InputNumber min={1} max={1000} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="days"
                  label="Дней VPN"
                  rules={[{ required: true, message: 'Введите дни' }]}
                >
                  <InputNumber min={1} max={365} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="traffic_gb"
                  label="Трафик (GB)"
                  tooltip="0 = безлимит"
                >
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item
              name="max_activations"
              label="Макс. активаций на код"
            >
              <InputNumber min={1} max={1000} style={{ width: '100%' }} />
            </Form.Item>

            <Form.Item style={{ marginBottom: 0, textAlign: 'right' }}>
              <Space>
                <Button onClick={handleCloseModal}>Отмена</Button>
                <Button type="primary" htmlType="submit" loading={generateLoading}>
                  Создать
                </Button>
              </Space>
            </Form.Item>
          </Form>
        ) : (
          <div>
            <Card style={{ marginBottom: 16 }}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text>
                  <strong>Batch ID:</strong> <Tag color="blue">{generatedResult.batch_id}</Tag>
                </Text>
                <Text>
                  <strong>Кампания:</strong> {generatedResult.campaign_name}
                </Text>
                <Text>
                  <strong>Создано кодов:</strong> {generatedResult.count}
                </Text>
              </Space>
            </Card>

            <Card
              title="Коды"
              size="small"
              style={{ marginBottom: 16, maxHeight: 300, overflow: 'auto' }}
            >
              {generatedResult.codes.map((code) => (
                <div key={code} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                  <Text code>{code}</Text>
                  <Button
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => handleCopyCode(code)}
                  />
                </div>
              ))}
            </Card>

            <Space style={{ width: '100%', justifyContent: 'space-between' }}>
              <Space>
                <Button
                  icon={<CopyOutlined />}
                  onClick={() => handleCopyAllCodes(generatedResult.codes)}
                >
                  Скопировать все
                </Button>
                <Button
                  icon={<DownloadOutlined />}
                  onClick={() => handleDownloadCSV(generatedResult)}
                >
                  Скачать CSV
                </Button>
              </Space>
              <Button type="primary" onClick={handleCloseModal}>
                Готово
              </Button>
            </Space>
          </div>
        )}
      </Modal>
    </List>
  );
};
