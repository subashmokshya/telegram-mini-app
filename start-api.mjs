import('ts-node/esm').then(() => {
    import('./api/api-server.ts').catch((err) => {
      console.error('❌ Failed to start API server:', err);
    });
  });
  