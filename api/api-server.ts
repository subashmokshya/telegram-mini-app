import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
dotenv.config();

import {
  runSessionOnce,
  closeAllPositions
} from '../botcore/botCore';

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

app.post('/run-session', async (_req: Request, res: Response) => {
  try {
    await runSessionOnce();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.post('/close-all', async (_req: Request, res: Response) => {
  try {
    await closeAllPositions();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

app.listen(PORT, () => {
  console.log(`📡 API server running on http://localhost:${PORT}`);
});
