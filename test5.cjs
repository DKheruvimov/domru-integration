const http = require('http');

const req = http.get('http://localhost:3100/api/domru/sip/auto-open/status', {
  headers: { 'x-demo-mode': 'true' }
}, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('STATUS:', data));
});
req.end();
