import express, { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import firebaseConfig from './firebase-applet-config.json' with { type: 'json' };

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

if (!getApps().length) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}
const adminAuth = getAuth();

const app = express();
const PORT = Number(process.env.PORT || 3000);

app.use(express.json({ limit: '2mb' }));

// Security headers
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
});

// Simple per-IP rate limiter for API routes
const rateBuckets = new Map<string, { count: number; resetAt: number }>();
function apiRateLimit(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || 'unknown';
  const now = Date.now();
  const bucket = rateBuckets.get(ip);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(ip, { count: 1, resetAt: now + 60_000 });
    return next();
  }
  if (bucket.count >= 120) {
    return res.status(429).json({ error: 'Too many requests. Please slow down.' });
  }
  bucket.count += 1;
  return next();
}

app.use('/api', apiRateLimit);

function sanitizeString(input: unknown, maxLen = 1000): string {
  if (typeof input !== 'string') return '';
  return input.replace(/[<>]/g, '').trim().slice(0, maxLen);
}

async function verifyBearerToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required for messaging dispatch.' });
  }
  const token = authHeader.slice('Bearer '.length).trim();
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    (req as Request & { authUser?: typeof decoded }).authUser = decoded;
    return next();
  } catch (err) {
    console.error('Token verification failed:', err);
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }
}

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: 'rk-mini-mall-erp',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/notifications/status', (_req: Request, res: Response) => {
  res.json({
    whatsappConfigured: Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID),
    smsConfigured: Boolean(process.env.SMS_GATEWAY_API_KEY),
    emailConfigured: Boolean(process.env.SMTP_WEBHOOK_URL),
  });
});

app.post('/api/notifications/dispatch', verifyBearerToken, async (req: Request, res: Response) => {
  const channel = sanitizeString(req.body?.channel, 20) as 'whatsapp' | 'sms' | 'email';
  const recipient = sanitizeString(req.body?.recipient, 160);
  const message = sanitizeString(req.body?.message, 2000);
  const templateName = sanitizeString(req.body?.templateName, 80);

  if (!channel || !recipient || !message) {
    return res.status(400).json({ ok: false, error: 'Missing channel, recipient, or message body.' });
  }

  if (channel === 'whatsapp') {
    const token = process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneId) {
      return res.status(422).json({
        ok: false,
        configured: false,
        status: 'failed_not_configured',
        providerResponse: 'WHATSAPP_ACCESS_TOKEN and WHATSAPP_PHONE_NUMBER_ID are not configured on the server.',
      });
    }

    try {
      const cleanPhone = recipient.replace(/[^\d]/g, '');
      const graphRes = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: cleanPhone,
          type: 'text',
          text: { body: message },
        }),
      });
      const payload = await graphRes.json().catch(() => ({}));
      if (!graphRes.ok) {
        return res.status(graphRes.status).json({
          ok: false,
          configured: true,
          status: 'failed',
          providerResponse: JSON.stringify(payload),
        });
      }
      return res.json({
        ok: true,
        configured: true,
        status: 'sent',
        providerMessageId: payload?.messages?.[0]?.id || null,
        providerResponse: JSON.stringify(payload),
      });
    } catch (err) {
      return res.status(502).json({
        ok: false,
        configured: true,
        status: 'failed',
        providerResponse: err instanceof Error ? err.message : 'WhatsApp network failure',
      });
    }
  }

  if (channel === 'sms') {
    const smsKey = process.env.SMS_GATEWAY_API_KEY;
    if (!smsKey) {
      return res.status(422).json({
        ok: false,
        configured: false,
        status: 'failed_not_configured',
        providerResponse: 'SMS_GATEWAY_API_KEY is not configured on the server.',
      });
    }
    return res.status(501).json({
      ok: false,
      configured: true,
      status: 'failed',
      providerResponse: `SMS gateway adapter requires provider endpoint configuration for template ${templateName}.`,
    });
  }

  if (channel === 'email') {
    const smtpWebhook = process.env.SMTP_WEBHOOK_URL;
    if (!smtpWebhook) {
      return res.status(422).json({
        ok: false,
        configured: false,
        status: 'failed_not_configured',
        providerResponse: 'SMTP_WEBHOOK_URL is not configured on the server.',
      });
    }
    try {
      const mailRes = await fetch(smtpWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: recipient, subject: templateName || 'RK Mini Mall Update', text: message }),
      });
      const text = await mailRes.text();
      return res.status(mailRes.ok ? 200 : mailRes.status).json({
        ok: mailRes.ok,
        configured: true,
        status: mailRes.ok ? 'sent' : 'failed',
        providerResponse: text.slice(0, 500),
      });
    } catch (err) {
      return res.status(502).json({
        ok: false,
        configured: true,
        status: 'failed',
        providerResponse: err instanceof Error ? err.message : 'Email relay error',
      });
    }
  }

  return res.status(400).json({ ok: false, error: 'Unsupported messaging channel.' });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Bhuvaneshwar Prasad RK Mini Mall ERP running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
