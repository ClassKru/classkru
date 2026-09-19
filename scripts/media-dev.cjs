'use strict';
// Two separate local origins; real Supabase/AI are used unless a test injects handlers.
const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
function createServer({media=false,handler,publicHandler,renderHandler,harness}={}) {
  return http.createServer(async(req,res)=>{
    const url=new URL(req.url,'http://127.0.0.1');
    req.query=Object.fromEntries(url.searchParams);
    res.status=code=>{res.statusCode=code;return res;};
    res.json=value=>{res.setHeader('Content-Type','application/json; charset=utf-8');res.end(JSON.stringify(value));};
    res.send=value=>res.end(value);
    req.headers['x-forwarded-proto']='http';
    try {
      if(harness&&url.pathname==='/harness'){res.setHeader('Content-Type','text/html; charset=utf-8');return res.end(harness);}
      if(req.method==='POST') {
        const chunks=[];let bytes=0;
        for await(const chunk of req){bytes+=chunk.length;if(bytes>32000){res.statusCode=413;res.end();return;}chunks.push(chunk);}
        req.body=Buffer.concat(chunks).toString();
      }
      if(media && url.pathname==='/api/render')return await (renderHandler||require('../media-host/api/render'))(req,res);
      if(!media && url.pathname==='/api/media-studio')return await (handler||require('../api/media-studio'))(req,res);
      if(!media && url.pathname==='/api/media-studio/public')return await (publicHandler||require('../api/media-studio/public'))(req,res);
      const pathname=url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname);
      const base=media?path.join(root,'media-host'):root;
      const target=path.resolve(base,'.'+pathname);
      if(!target.startsWith(base+path.sep)||/(?:^|[\/\\])(?:\.|api|node_modules|scripts|tests|supabase|docs)/.test(pathname)||!/[.](?:html|css|js|png|svg|woff2?|jpg)$/.test(target))return res.status(404).send('Not found');
      const types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.png':'image/png','.svg':'image/svg+xml'};
      res.setHeader('Content-Type',(types[path.extname(target)]||'application/octet-stream')+'; charset=utf-8');
      res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
      res.end(await fs.promises.readFile(target));
    }catch(error){res.statusCode=error.code==='ENOENT'?404:500;res.end('Request failed');}
  });
}
if(require.main===module){
  const env=path.join(root,'.env.local');if(fs.existsSync(env))process.loadEnvFile(env);
  process.env.CLASSKRU_APP_ORIGIN='http://127.0.0.1:3511';process.env.MEDIA_ORIGIN='http://127.0.0.1:3512';
  if(!process.env.MEDIA_BROWSER_EXECUTABLE && process.platform==='win32')process.env.MEDIA_BROWSER_EXECUTABLE='C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  createServer().listen(3511,'127.0.0.1',()=>console.log('ClassKru: http://127.0.0.1:3511'));
  createServer({media:true}).listen(3512,'127.0.0.1',()=>console.log('Media: http://127.0.0.1:3512'));
}
module.exports={createServer};
