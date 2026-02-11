import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';

export default function Dashboard() {
  const { data: session } = useSession();
  const [status, setStatus] = useState('unknown');

  const fetchStatus = async () => {
    const res = await fetch(`/api/agent/status/${session?.user?.id}`);
    if(res.ok){
      const data = await res.json();
      setStatus(data.status);
    }
  }

  const deployAgent = async () => {
    const res = await fetch('/api/agent/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: session?.user?.id, apiKey: 'USER_OPENAI_KEY', telegramToken: 'USER_TELEGRAM_TOKEN' })
    });
    if(res.ok) {
      alert('Agent deploying!');
      fetchStatus();
    }
  };

  useEffect(() => { if(session?.user?.id) fetchStatus(); }, [session]);

  return (
    <div className="p-10 text-center">
      <h1>Welcome, {session?.user?.name}</h1>
      <button onClick={deployAgent} className="mt-5 px-5 py-3 bg-blue-600 text-white rounded-lg">Deploy My Agent</button>
      <div className="mt-5">Agent Status: {status}</div>
    </div>
  );
}