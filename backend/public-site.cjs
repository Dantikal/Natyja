// Public entry point serves only the production build and the existing authenticated API.
const express = require('express');
const http = require('node:http');
const path = require('node:path');
const { isIP } = require('node:net');
const compression = require('compression');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const app = express();
app.disable('x-powered-by');
app.use(compression({ threshold: 1024 }));
app.use(require('./src/middleware/securityHeaders'));
app.use((req,res,next)=>{
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Referrer-Policy','same-origin');
 if(!/^\/(api|uploads)(\/|$)/.test(req.url))return next();
 const clientIp = process.env.TRUST_CLOUDFLARE_HEADERS === 'true' && isIP(req.headers['cf-connecting-ip'] || '') ? req.headers['cf-connecting-ip'] : req.socket.remoteAddress;
 const headers = {...req.headers,host:'127.0.0.1:5000','x-forwarded-for':clientIp,'x-public-gateway':'1'};
 delete headers.forwarded;
 delete headers['x-forwarded-host'];
 delete headers['x-forwarded-proto'];
 delete headers['cf-connecting-ip'];
 const upstream=http.request({hostname:'127.0.0.1',port:5000,path:req.url,method:req.method,headers},response=>{
  res.writeHead(response.statusCode,response.headers);response.pipe(res);
 });
 upstream.on('error',()=>{if(!res.headersSent)res.status(502).json({error:'Сервер временно недоступен'});else res.end();});
 upstream.setTimeout(120000, () => upstream.destroy());
 req.on('aborted',()=>upstream.destroy());req.pipe(upstream);
});
const build=path.resolve(__dirname,'../frontend/build');
app.use((req, res, next) => /\.map$/i.test(req.path) ? res.sendStatus(404) : next());
app.use('/static', express.static(path.join(build,'static'), { maxAge:'1y', immutable:true, index:false, setHeaders:(res,file)=>{ if(file.endsWith('.map')) res.setHeader('Cache-Control','no-store'); } }));
app.use(express.static(build,{index:false,maxAge:'1h'}));
app.get('*',(req,res)=>{res.setHeader('Cache-Control','no-cache');res.sendFile(path.join(build,'index.html'));});
app.listen(8080,'127.0.0.1',()=>console.log('Public website gateway: http://127.0.0.1:8080'));
