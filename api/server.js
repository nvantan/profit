const http = require('http');
const https = require('https');

const server = http.createServer((req, res) => {
  // CORS headers - Updated to include POST
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Handle Exbitron proxy (logic based on proxy.js)
  if (req.url === '/api/exbitron' || req.url === '/api/proxy') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      console.log(`Proxying ${req.method} ${req.url} -> https://base.exbitron.com/api`);
      
      const options = {
        hostname: 'base.exbitron.com',
        path: '/api',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Origin': 'https://exbitron.com',
          'Referer': 'https://exbitron.com/',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        }
      };

      const proxyReq = https.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, { 'Content-Type': proxyRes.headers['content-type'] || 'application/json' });
        proxyRes.pipe(res);
      });

      proxyReq.on('error', (err) => {
        console.error('Exbitron proxy error:', err.message);
        res.writeHead(502);
        res.end(JSON.stringify({ error: 'Proxy error', message: err.message }));
      });

      if (body) {
        proxyReq.write(body);
      }
      proxyReq.end();
    });
    return;
  }

  // Static routes for ZPool
  const staticRoutes = {
    '/api/zpool': 'https://zpool.ca/api/currencies',
    '/api/zpool-profitability': 'https://zpool.ca/json/algo_profitability.json',
    '/api/zpool-hashrate': 'https://zpool.ca/json/algos_hashrate.json',
    '/api/zpool-algos': 'https://zpool.ca/json/menu/algos.json',
    '/api/algos': 'https://zpool.ca/json/menu/algos.json'
  };

  const factorMatch = req.url.match(/^\/api\/zpool-factor\/([a-zA-Z0-9_]+)$/);
  let targetUrl = staticRoutes[req.url];

  if (!targetUrl && factorMatch) {
    targetUrl = `https://zpool.ca/ajax/algo_api_mbtc_mh_factor/${factorMatch[1]}`;
  }

  if (targetUrl) {
    console.log(`Proxying ${req.url} -> ${targetUrl}`);

    https.get(targetUrl, (zRes) => {
      res.writeHead(zRes.statusCode, { 'Content-Type': 'application/json' });
      zRes.pipe(res);
    }).on('error', (err) => {
      console.error('ZPool proxy error:', err.message);
      res.writeHead(500);
      res.end(JSON.stringify({ error: err.message }));
    });
  } else {
    res.writeHead(404);
    res.end('Not Found');
  }
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`🚀 Proxy server đang chạy tại: http://localhost:${PORT}`);
  console.log(`📡 Endpoints:`);
  console.log(`   - http://localhost:${PORT}/api/zpool`);
  console.log(`   - http://localhost:${PORT}/api/zpool-profitability`);
  console.log(`   - http://localhost:${PORT}/api/zpool-hashrate`);
  console.log(`   - http://localhost:${PORT}/api/zpool-factor/:algo`);
  console.log(`   - http://localhost:${PORT}/api/exbitron (Proxy to base.exbitron.com)`);
});