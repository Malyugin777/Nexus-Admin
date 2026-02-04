import { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Typography, message, Space, Alert, Spin, Result } from 'antd';
import { UserOutlined, LockOutlined, MailOutlined, RobotOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useSearchParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { LanguageSwitcher } from '../../components';

const { Title, Text, Link } = Typography;

interface RegisterForm {
  username: string;
  email: string;
  password: string;
  confirmPassword: string;
}

interface InviteInfo {
  valid: boolean;
  email: string | null;
  role: string;
}

export const Register = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [form] = Form.useForm();

  // Check invite token on mount
  useEffect(() => {
    const checkInvite = async () => {
      if (!token) {
        setError('Токен приглашения не указан');
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get(`/api/v1/auth/invite-check/${token}`);
        setInviteInfo(response.data);
        // If email is pre-set, fill it in the form
        if (response.data.email) {
          form.setFieldValue('email', response.data.email);
        }
      } catch (err: unknown) {
        const error = err as { response?: { data?: { detail?: string } } };
        setError(error.response?.data?.detail || 'Недействительный токен приглашения');
      } finally {
        setLoading(false);
      }
    };

    checkInvite();
  }, [token, form]);

  const onFinish = async (values: RegisterForm) => {
    if (values.password !== values.confirmPassword) {
      message.error('Пароли не совпадают');
      return;
    }

    setRegistering(true);
    try {
      await axios.post('/api/v1/auth/register-invite', {
        token,
        username: values.username,
        email: values.email,
        password: values.password,
      });
      setSuccess(true);
      message.success('Аккаунт успешно создан!');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { detail?: string } } };
      message.error(error.response?.data?.detail || 'Ошибка регистрации');
    } finally {
      setRegistering(false);
    }
  };

  // Show loading state
  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        }}
      >
        <Spin size="large" />
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        }}
      >
        <Card style={{ width: 400 }}>
          <Result
            status="error"
            title="Ошибка приглашения"
            subTitle={error}
            extra={
              <Button type="primary" onClick={() => navigate('/login')}>
                Перейти к входу
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  // Show success state
  if (success) {
    return (
      <div
        style={{
          height: '100vh',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        }}
      >
        <Card style={{ width: 400 }}>
          <Result
            status="success"
            title="Регистрация завершена!"
            subTitle="Теперь вы можете войти с вашими учетными данными"
            extra={
              <Button type="primary" onClick={() => navigate('/login')}>
                Войти
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
        position: 'relative',
      }}
    >
      {/* Language Switcher */}
      <div style={{ position: 'absolute', top: 16, right: 16 }}>
        <LanguageSwitcher />
      </div>

      <Card
        style={{
          width: 400,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        }}
      >
        <Space direction="vertical" style={{ width: '100%', textAlign: 'center' }}>
          <RobotOutlined style={{ fontSize: 48, color: '#52c41a' }} />
          <Title level={2} style={{ margin: 0 }}>
            Регистрация
          </Title>
          <Text type="secondary">Создание аккаунта администратора</Text>
        </Space>

        <Alert
          type="info"
          showIcon
          icon={<CheckCircleOutlined />}
          message={`Приглашение действительно (роль: ${inviteInfo?.role})`}
          style={{ marginTop: 16 }}
        />

        <Form
          form={form}
          name="register"
          onFinish={onFinish}
          layout="vertical"
          style={{ marginTop: 24 }}
        >
          <Form.Item
            name="username"
            rules={[
              { required: true, message: 'Введите имя пользователя' },
              { min: 3, message: 'Минимум 3 символа' },
              { max: 100, message: 'Максимум 100 символов' },
            ]}
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="Имя пользователя"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Введите email' },
              { type: 'email', message: 'Неверный формат email' },
            ]}
          >
            <Input
              prefix={<MailOutlined />}
              placeholder="Email"
              size="large"
              disabled={!!inviteInfo?.email}
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: 'Введите пароль' },
              { min: 6, message: 'Минимум 6 символов' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Пароль"
              size="large"
            />
          </Form.Item>

          <Form.Item
            name="confirmPassword"
            dependencies={['password']}
            rules={[
              { required: true, message: 'Подтвердите пароль' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Пароли не совпадают'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Подтверждение пароля"
              size="large"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={registering}
            >
              Создать аккаунт
            </Button>
          </Form.Item>

          <div style={{ textAlign: 'center' }}>
            <Link onClick={() => navigate('/login')}>
              Уже есть аккаунт? Войти
            </Link>
          </div>
        </Form>
      </Card>
    </div>
  );
};
