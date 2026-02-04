import { useState } from 'react';
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
  Modal,
  Form,
  Input,
  InputNumber,
  Popconfirm,
  message,
  Spin,
  Typography,
  Tooltip,
  Progress,
} from 'antd';
import {
  CloudServerOutlined,
  PlusOutlined,
  DeleteOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  HddOutlined,
} from '@ant-design/icons';

const { Title, Text } = Typography;

interface SystemStats {
  version: string;
  mem_total: number;
  mem_used: number;
  cpu_cores: number;
  cpu_usage: number;
  total_user: number;
  users_active: number;
  incoming_bandwidth: number;
  outgoing_bandwidth: number;
  incoming_bandwidth_speed: number;
  outgoing_bandwidth_speed: number;
}

interface Node {
  id: number;
  name: string;
  address: string;
  port: number;
  api_port: number;
  usage_coefficient: number;
  status: string;
  message?: string;
  xray_version?: string;
}

interface NodesResponse {
  system_stats: SystemStats;
  nodes: Node[];
}

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

const formatBytes = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatSpeed = (bytesPerSec: number): string => {
  return formatBytes(bytesPerSec) + '/s';
};

export const NodesList = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form] = Form.useForm();

  const { data, isLoading, refetch } = useCustom<NodesResponse>({
    url: '/nodes',
    method: 'get',
  });

  const systemStats = data?.data?.system_stats;
  const nodes = data?.data?.nodes || [];

  const handleAddNode = async (values: {
    name: string;
    address: string;
    port: number;
    api_port: number;
    usage_coefficient: number;
  }) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/nodes`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(values),
      });

      if (response.ok) {
        message.success('Узел добавлен');
        setIsModalOpen(false);
        form.resetFields();
        refetch();
      } else {
        const error = await response.json();
        message.error(error.detail || 'Ошибка при добавлении узла');
      }
    } catch {
      message.error('Ошибка при добавлении узла');
    }
  };

  const handleDeleteNode = async (nodeId: number) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/nodes/${nodeId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        message.success('Узел удалён');
        refetch();
      } else {
        const error = await response.json();
        message.error(error.detail || 'Ошибка при удалении узла');
      }
    } catch {
      message.error('Ошибка при удалении узла');
    }
  };

  const handleReconnectNode = async (nodeId: number) => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await fetch(`${API_URL}/nodes/${nodeId}/reconnect`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        message.success('Переподключение запущено');
        refetch();
      } else {
        const error = await response.json();
        message.error(error.detail || 'Ошибка при переподключении');
      }
    } catch {
      message.error('Ошибка при переподключении');
    }
  };

  const columns = [
    {
      title: 'Имя',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => (
        <Space>
          <HddOutlined />
          <Text strong>{name}</Text>
        </Space>
      ),
    },
    {
      title: 'IP Адрес',
      dataIndex: 'address',
      key: 'address',
      render: (address: string) => <code>{address}</code>,
    },
    {
      title: 'Порт',
      dataIndex: 'port',
      key: 'port',
      render: (port: number, record: Node) => (
        <Tooltip title={`API: ${record.api_port}`}>
          <code>{port}</code>
        </Tooltip>
      ),
    },
    {
      title: 'Статус',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: Node) => {
        const isConnected = status === 'connected';
        return (
          <Tooltip title={record.message || status}>
            <Tag
              icon={isConnected ? <CheckCircleOutlined /> : <CloseCircleOutlined />}
              color={isConnected ? 'success' : 'error'}
            >
              {isConnected ? 'Online' : 'Offline'}
            </Tag>
          </Tooltip>
        );
      },
    },
    {
      title: 'Коэффициент',
      dataIndex: 'usage_coefficient',
      key: 'usage_coefficient',
      render: (coef: number) => <Tag color="blue">x{coef}</Tag>,
    },
    {
      title: 'Xray',
      dataIndex: 'xray_version',
      key: 'xray_version',
      render: (version: string) =>
        version ? <Tag color="purple">{version}</Tag> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Действия',
      key: 'actions',
      render: (_: unknown, record: Node) => (
        <Space>
          <Tooltip title="Переподключить">
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={() => handleReconnectNode(record.id)}
            />
          </Tooltip>
          <Popconfirm
            title="Удалить узел?"
            description="Это действие нельзя отменить"
            onConfirm={() => handleDeleteNode(record.id)}
            okText="Да"
            cancelText="Нет"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (isLoading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  const memPercent = systemStats
    ? Math.round((systemStats.mem_used / systemStats.mem_total) * 100)
    : 0;
  const cpuPercent = systemStats ? Math.round(systemStats.cpu_usage) : 0;

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Title level={3} style={{ margin: 0 }}>
          <CloudServerOutlined style={{ marginRight: 8 }} />
          VPN Узлы
        </Title>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => setIsModalOpen(true)}>
          Добавить узел
        </Button>
      </div>

      {/* Master Node Stats */}
      <Card
        title={
          <Space>
            <CheckCircleOutlined style={{ color: '#52c41a' }} />
            <span>Master Node (Панель)</span>
            {systemStats?.version && <Tag color="blue">v{systemStats.version}</Tag>}
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        <Row gutter={24}>
          <Col span={4}>
            <Statistic
              title="CPU"
              value={cpuPercent}
              suffix="%"
              valueStyle={{ color: cpuPercent > 80 ? '#ff4d4f' : '#52c41a' }}
            />
            <Progress
              percent={cpuPercent}
              size="small"
              showInfo={false}
              strokeColor={cpuPercent > 80 ? '#ff4d4f' : '#52c41a'}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="RAM"
              value={memPercent}
              suffix="%"
              valueStyle={{ color: memPercent > 80 ? '#ff4d4f' : '#1890ff' }}
            />
            <Progress
              percent={memPercent}
              size="small"
              showInfo={false}
              strokeColor={memPercent > 80 ? '#ff4d4f' : '#1890ff'}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {systemStats ? `${formatBytes(systemStats.mem_used)} / ${formatBytes(systemStats.mem_total)}` : '—'}
            </Text>
          </Col>
          <Col span={4}>
            <Statistic
              title="Пользователей"
              value={systemStats?.users_active || 0}
              suffix={`/ ${systemStats?.total_user || 0}`}
            />
          </Col>
          <Col span={4}>
            <Statistic
              title="Входящий"
              value={formatBytes(systemStats?.incoming_bandwidth || 0)}
              valueStyle={{ fontSize: 18 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {formatSpeed(systemStats?.incoming_bandwidth_speed || 0)}
            </Text>
          </Col>
          <Col span={4}>
            <Statistic
              title="Исходящий"
              value={formatBytes(systemStats?.outgoing_bandwidth || 0)}
              valueStyle={{ fontSize: 18 }}
            />
            <Text type="secondary" style={{ fontSize: 12 }}>
              {formatSpeed(systemStats?.outgoing_bandwidth_speed || 0)}
            </Text>
          </Col>
          <Col span={4}>
            <Statistic title="CPU Cores" value={systemStats?.cpu_cores || 0} />
          </Col>
        </Row>
      </Card>

      {/* Edge Nodes Table */}
      <Card
        title={
          <Space>
            <HddOutlined />
            <span>Edge Nodes ({nodes.length})</span>
          </Space>
        }
        extra={
          <Button icon={<ReloadOutlined />} onClick={() => refetch()}>
            Обновить
          </Button>
        }
      >
        {nodes.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <CloudServerOutlined style={{ fontSize: 48, color: '#888', marginBottom: 16 }} />
            <div>
              <Text type="secondary">Нет подключённых узлов</Text>
            </div>
            <div style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Добавьте Edge Node для распределения нагрузки
              </Text>
            </div>
          </div>
        ) : (
          <Table dataSource={nodes} columns={columns} rowKey="id" pagination={false} />
        )}
      </Card>

      {/* Add Node Modal */}
      <Modal
        title="Добавить Edge Node"
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
        }}
        footer={null}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleAddNode}
          initialValues={{
            port: 62050,
            api_port: 62051,
            usage_coefficient: 1.0,
          }}
        >
          <Form.Item
            name="name"
            label="Название узла"
            rules={[{ required: true, message: 'Введите название' }]}
          >
            <Input placeholder="Aeza-NL-1" />
          </Form.Item>

          <Form.Item
            name="address"
            label="IP адрес"
            rules={[{ required: true, message: 'Введите IP адрес' }]}
          >
            <Input placeholder="45.x.x.x" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="port"
                label="Порт"
                rules={[{ required: true, message: 'Введите порт' }]}
              >
                <InputNumber style={{ width: '100%' }} min={1} max={65535} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="api_port"
                label="API порт"
                rules={[{ required: true, message: 'Введите API порт' }]}
              >
                <InputNumber style={{ width: '100%' }} min={1} max={65535} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="usage_coefficient" label="Коэффициент нагрузки">
            <InputNumber style={{ width: '100%' }} min={0.1} max={10} step={0.1} />
          </Form.Item>

          <div
            style={{
              background: '#1a1a1a',
              padding: 12,
              borderRadius: 6,
              marginBottom: 16,
            }}
          >
            <Space>
              <ClockCircleOutlined style={{ color: '#faad14' }} />
              <Text type="secondary" style={{ fontSize: 12 }}>
                Перед добавлением установите marzban-node на целевой сервер
              </Text>
            </Space>
          </div>

          <Form.Item style={{ marginBottom: 0 }}>
            <Space style={{ width: '100%', justifyContent: 'flex-end' }}>
              <Button onClick={() => setIsModalOpen(false)}>Отмена</Button>
              <Button type="primary" htmlType="submit">
                Добавить
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
