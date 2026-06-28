const http = require('http');

http.get('http://127.0.0.1:3100/api/domru/sip/auto-open/status', {
  headers: { 'x-demo-mode': 'true' }
}, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => console.log('STATUS:', data));
}).on('error', err => console.error(err));
