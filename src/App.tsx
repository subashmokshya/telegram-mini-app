import React, { useEffect, useState } from 'react';

declare global {
  interface Window {
    Telegram: any;
  }
}

// ✅ Correct env var syntax for CRA
const API_BASE = process.env.REACT_APP_API_BASE || 'http://localhost:3000';

function App() {
  const [status, setStatus] = useState<string>('');
  const [tgUser, setTgUser] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    const tg = window?.Telegram?.WebApp;
    if (!tg) {
      setStatus('⚠️ Telegram WebApp not available');
      return;
    }

    tg.ready();
    tg.expand();
    setTgUser(tg?.initDataUnsafe?.user?.username ?? null);
  }, []);

  const callEndpoint = async (path: string) => {
    setStatus('⏳ Working...');
    setIsLoading(true);

    try {
      const res = await fetch(`${API_BASE}${path}`, {
        method: 'POST',
      });

      const data = await res.json();
      if (data.success) {
        setStatus('✅ Success');
      } else {
        setStatus(`⚠️ Error: ${data.error}`);
      }
    } catch (err) {
      setStatus(`❌ Failed: ${(err as Error).message}`);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-100 text-center">
      <h1 className="text-2xl font-bold mb-4">🚀 30m1hr Trading Bot</h1>
      {tgUser && <p className="text-sm text-gray-600 mb-2">👤 User: {tgUser}</p>}
      <div className="space-y-4 w-full max-w-xs">
        <button
          className="bg-blue-600 text-white py-2 px-4 rounded w-full hover:bg-blue-700 disabled:opacity-50"
          onClick={() => callEndpoint('/run-session')}
          disabled={isLoading}
        >
          ▶️ Start Bot
        </button>
        <button
          className="bg-red-600 text-white py-2 px-4 rounded w-full hover:bg-red-700 disabled:opacity-50"
          onClick={() => callEndpoint('/close-all')}
          disabled={isLoading}
        >
          ❌ Close All
        </button>
      </div>
      <div className="mt-6 text-sm text-gray-700">{status}</div>
    </div>
  );
}

export default App;
