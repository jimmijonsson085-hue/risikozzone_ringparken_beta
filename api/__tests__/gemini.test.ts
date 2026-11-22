import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { POST, resetRateLimiterForTests } from '../gemini';

describe('api/gemini serverless handler validation & rate limiting', () => {
  beforeEach(() => {
    resetRateLimiterForTests();
  });

  it('rejects unsupported image MIME types with HTTP 415', async () => {
    const req = new Request('https://example.test/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '203.0.113.10',
      },
      body: JSON.stringify({
        description: 'Test foto',
        imageBase64: 'SGVsbG8=',
        imageMimeType: 'image/svg+xml',
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 415);
    const body = (await res.json()) as { error?: string };
    assert.ok(body.error?.includes('image/jpeg'));
  });

  it('rejects photos larger than 8 MB with HTTP 413', async () => {
    // 8 MB + 300 bytes når base64-dekodet (~10.9 MB base64-streng)
    const oversizedBase64 = 'A'.repeat(11 * 1024 * 1024);
    const req = new Request('https://example.test/api/gemini', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '203.0.113.11',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType: 'image/jpeg',
                  data: oversizedBase64,
                },
              },
              { text: 'Støvsky uden vanding' },
            ],
          },
        ],
      }),
    });

    const res = await POST(req);
    assert.equal(res.status, 413);
  });

  it('returns HTTP 503 when GEMINI_API_KEY is missing on server without leaking stacktraces', async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      const req = new Request('https://example.test/api/gemini', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-forwarded-for': '203.0.113.12',
        },
        body: JSON.stringify({
          description: 'Støvsky ved Kierulffsvej 12',
          imageBase64: 'SGVsbG8=',
          imageMimeType: 'image/png',
        }),
      });

      const res = await POST(req);
      assert.equal(res.status, 503);
      const body = (await res.json()) as { error?: string };
      assert.ok(body.error?.includes('GEMINI_API_KEY'));
      assert.equal('stack' in body, false);
    } finally {
      if (prevKey !== undefined) process.env.GEMINI_API_KEY = prevKey;
    }
  });

  it('enforces per-IP rate limiting with HTTP 429', async () => {
    const prevKey = process.env.GEMINI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    try {
      let lastStatus = 0;
      for (let i = 0; i < 21; i++) {
        const req = new Request('https://example.test/api/gemini', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-forwarded-for': '198.51.100.77',
          },
          body: JSON.stringify({ description: 'Test' }),
        });
        const res = await POST(req);
        lastStatus = res.status;
      }
      assert.equal(lastStatus, 429);
    } finally {
      if (prevKey !== undefined) process.env.GEMINI_API_KEY = prevKey;
    }
  });
});
