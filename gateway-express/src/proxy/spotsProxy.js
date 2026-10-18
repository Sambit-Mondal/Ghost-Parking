const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware');

const searchServiceUrl = process.env.SEARCH_SERVICE_URL || 'http://localhost:8080';

/**
 * spotsProxy
 * Securely forwards /api/spots requests from mobile clients to the Go Search Engine service.
 * Rewrites /api/spots -> /spots (e.g. /api/spots/nearby?latitude=...&longitude=... -> /spots/nearby?latitude=...&longitude=...)
 */
const spotsProxy = createProxyMiddleware({
  target: searchServiceUrl,
  changeOrigin: true,
  pathRewrite: (path, req) => {
    // Reliably map originalUrl /api/spots/* -> /spots/*
    const targetPath = (req.originalUrl || path).replace(/^\/api\/spots/, '/spots');
    return targetPath;
  },
  on: {
    proxyReq: (proxyReq, req) => {
      // Security & provenance headers
      proxyReq.setHeader('x-gateway-source', 'ghost-parking-express');
      proxyReq.setHeader('x-forwarded-host', req.headers.host || 'localhost:3000');
      proxyReq.setHeader('x-forwarded-for', req.ip || req.connection.remoteAddress || '');
      proxyReq.setHeader('x-forwarded-proto', req.protocol || 'http');

      // Re-stream parsed JSON body if present
      fixRequestBody(proxyReq, req);
    },
    error: (err, req, res) => {
      console.error('[Spots Proxy] Error communicating with Go search engine:', err.message);
      if (!res.headersSent) {
        res.status(502).json({
          error: 'Bad Gateway: Go search engine service is unavailable',
          target: searchServiceUrl,
          details: err.message,
        });
      }
    },
  },
});

module.exports = spotsProxy;
