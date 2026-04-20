export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(200).end(); return;
  }

  // Determine the request path (handling Vercel rewrites)
  let requestPath = req.query?.path ? `/api/${req.query.path}` : req.url;

  // Normalize path: if it starts with /api/proxy/..., change it to /api/...
  if (requestPath.startsWith('/api/proxy/')) {
    requestPath = requestPath.replace('/api/proxy/', '/api/');
  } else if (requestPath === '/api/proxy') {
    requestPath = '/api/proxy'; // Keep as is for POST fallback
  }

  // ZPool.ca static routes
  const staticRoutes = {
    '/api/zpool': 'https://zpool.ca/api/currencies',
    '/api/zpool-profitability': 'https://zpool.ca/json/algo_profitability.json',
    '/api/zpool-hashrate': 'https://zpool.ca/json/algos_hashrate.json',
    '/api/zpool-algos': 'https://zpool.ca/json/menu/algos.json',
    '/api/algos': 'https://zpool.ca/json/menu/algos.json'
  };

  // Determine target URL
  let targetUrl = staticRoutes[requestPath];
  const factorMatch = requestPath?.match(/^\/api\/zpool-factor\/([a-zA-Z0-9_]+)$/);

  let useExbitronHeaders = false;

  console.log({ requestPath, targetUrl, factorMatch })

  if (!targetUrl && factorMatch) {
    console.log('Fetching factor for', factorMatch[1]);
    targetUrl = `https://zpool.ca/ajax/algo_api_mbtc_mh_factor/${factorMatch[1]}`;
  }

  // Default to Exbitron for POST requests if no zpool route matched
  if (!targetUrl && req.method === 'POST') {
    targetUrl = 'https://base.exbitron.com/api';
    useExbitronHeaders = true;
  }

  if (!targetUrl) {
    res.status(404).json({ error: 'Endpoint not found' }); return;
  }

  try {
    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (useExbitronHeaders) {
      fetchOptions.headers['Origin'] = 'https://exbitron.com';
      fetchOptions.headers['Referer'] = 'https://exbitron.com/';
      fetchOptions.headers['User-Agent'] = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
    }

    if (req.method === 'POST' && req.body) {
      fetchOptions.body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    }

    const response = await fetch(targetUrl, fetchOptions);
    const contentType = response.headers.get('content-type') || '';

    const data = contentType.includes('application/json')
      ? await response.json()
      : { message: await response.text() };

    res.status(response.status).json(data);
  } catch (err) {
    res.status(502).json({ error: 'Proxy error', message: err.message });
  }
}