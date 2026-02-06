import { useEffect, useState } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || '/api/v1';

export const Footer: React.FC = () => {
  const [version, setVersion] = useState<string | null>(null);

  useEffect(() => {
    fetchVersion();
  }, []);

  const fetchVersion = async () => {
    try {
      const token = localStorage.getItem('access_token');
      const response = await axios.get(`${API_URL}/stats`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVersion(response.data.version);
    } catch {
      // Failed to fetch version
    }
  };

  return (
    <div style={{
      height: '40px',
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: '#141414',
      borderTop: '1px solid #303030',
      color: '#a0a0a0',
      fontSize: '12px',
      marginTop: '24px',
    }}>
      Nexus Control Panel {version && `v${version}`}
    </div>
  );
};
