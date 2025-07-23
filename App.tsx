import React from 'react';
import { useEffect, useState } from 'react';

declare global {
  interface Window {
    Telegram: any;
  }
}

const API_BASE = 'http://localhost:3000/run-session'; // 🧠 Change this to your deployed Express backend

function App() {
  const [status, setStatus] = useState<string>('');
  const [tgUser, setTgUser] = useState<string | null>(null);

  useEffect(() => {
    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();
    setTgUser(tg?.initDataUnsafe?.user?.username ?? null);
  }, []);

  const callEndpoint = async (path: string) => {
    setStatus('⏳ Working...');
    try {
      const res = await fetch(`${API_BASE}${path}`, { method: 'POST' });
      const data = await res.json();
      if (data.success) {
        setStatus('✅ Success');
      } else {
        setStatus(`⚠️ Error: ${data.error}`);
      }
    } catch (err) {
      setStatus(`❌ Failed: ${(err as Error).message}`);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-100 text-center">
      <h1 className="text-2xl font-bold mb-4">🚀 30m1hr Trading Bot</h1>
      {tgUser && <p className="text-sm text-gray-600 mb-2">👤 User: {tgUser}</p>}
      <div className="space-y-4 w-full max-w-xs">
        <button
          className="bg-blue-600 text-white py-2 px-4 rounded w-full hover:bg-blue-700"
          onClick={() => callEndpoint('/run-session')}
        >
          ▶️ Start Bot
        </button>
        <button
          className="bg-red-600 text-white py-2 px-4 rounded w-full hover:bg-red-700"
          onClick={() => callEndpoint('/close-all')}
        >
          ❌ Close All
        </button>
      </div>
      <div className="mt-6 text-sm text-gray-700">{status}</div>
    </div>
  );
}

export default App;
