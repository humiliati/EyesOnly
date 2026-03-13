const http = require('http');
const fs = require('fs');
const path = require('path');
const server = http.createServer((req, res) => {
  let fp = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
  if (!fs.existsSync(fp)) { res.writeHead(404); res.end('Not found'); return; }
  const ext = path.extname(fp);
  const types = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.json':'application/json','.png':'image/png','.jpg':'image/jpeg'};
  res.writeHead(200, {'Content-Type': types[ext]||'application/octet-stream'});
  fs.createReadStream(fp).pipe(res);
});
server.listen(9090, '0.0.0.0', () => console.log('Serving on http://localhost:9090'));
