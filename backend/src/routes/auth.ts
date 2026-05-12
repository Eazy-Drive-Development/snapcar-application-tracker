import { Router, Request, Response } from 'express';
import dotenv from 'dotenv';

dotenv.config();

const router = Router();

router.post('/login', (req: Request, res: Response) => {
  try {
    const loginUsername = process.env.LOGIN_USERNAME ?? 'admin';
    const loginPassword = process.env.LOGIN_PASSWORD ?? 'password123';

    const { username, password } = req.body as { username?: string; password?: string };

    if (!username || !password) {
      return res.status(400).json({ ok: false, message: 'Username and password are required.' });
    }

    if (username !== loginUsername || password !== loginPassword) {
      return res.status(401).json({ ok: false, message: 'Username or password is incorrect.' });
    }

    return res.json({ ok: true, message: 'Login successful.' });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auth login error:', error);
    return res.status(500).json({ ok: false, message: 'Internal server error' });
  }
});

export default router;
