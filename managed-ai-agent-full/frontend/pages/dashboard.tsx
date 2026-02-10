import { useSession } from 'next-auth/react';
export default function Dashboard() {
  const { data: session } = useSession();
  const deployAgent = async () => {
    const res = await fetch('/api/agent/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: session?.user?.id, apiKey: 'USER_OPENAI_KEY', telegramToken: 'USER_TELEGRAM_TOKEN' })
    });
    if(res.ok) alert('Agent deploying!');
  };
  return (
    <div className="p-10 text-center">
      <h1>Welcome, {session?.user?.name}</h1>
      <button onClick={deployAgent} className="mt-5 px-5 py-3 bg-blue-600 text-white rounded-lg">Deploy My Agent</button>
    </div>
  );
}