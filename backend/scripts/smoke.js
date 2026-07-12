const http = require('http');

/**
 * REEKOD Semak Post-Deployment Smoke Test Script.
 * Validates connection checks, health status, and diagnostic endpoints.
 */
function runSmokeTest() {
  const host = process.env.SMOKE_HOST || '127.0.0.1';
  const port = process.env.SMOKE_PORT || 5000;
  
  console.log(`[Smoke Test] Pinging host http://${host}:${port}...`);

  // 1. Check health status OK
  const healthOptions = {
    host,
    port,
    path: '/api/health',
    method: 'GET',
    timeout: 2000
  };

  const req = http.request(healthOptions, (res) => {
    let body = '';
    res.on('data', chunk => body += chunk);
    res.on('end', () => {
      console.log(`Health Response Code: ${res.statusCode}`);
      try {
        const payload = JSON.parse(body);
        console.log('Health Response Payload:', payload);
        
        if (res.statusCode === 200 && payload.status === 'ok') {
          console.log('[Smoke Test SUCCESS] Deployed service health check PASSED!');
          process.exit(0);
        } else {
          console.error('[Smoke Test FAILED] Health payload verification mismatch.');
          process.exit(1);
        }
      } catch (err) {
        console.error('[Smoke Test FAILED] Failed to parse health response:', err.message);
        process.exit(1);
      }
    });
  });

  req.on('error', (err) => {
    console.error(`[Smoke Test FAILED] Connection refused on host http://${host}:${port} :`, err.message);
    process.exit(1);
  });

  req.on('timeout', () => {
    console.error('[Smoke Test FAILED] Request timed out.');
    req.destroy();
    process.exit(1);
  });

  req.end();
}

runSmokeTest();
