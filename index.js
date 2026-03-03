const express = require('express');
const cors = require('cors');
const https = require('https');
const http = require('http');
const app = express();

app.use(cors());
app.use(express.json());

const channels = require('./channels.json');

const manifest = {
  id: 'com.meucanal.lives',
  version: '1.0.0',
  name: '📺 Meus Canais Ao Vivo',
  description: 'Seus canais ao vivo personalizados no Stremio',
  resources: ['catalog', 'meta', 'stream'],
  types: ['tv'],
  catalogs: [{ type: 'tv', id: 'lives-catalog', name: '📺 Ao Vivo', extra: [{ name: 'search', isRequired: false }] }],
  idPrefixes: ['live_'],
  behaviorHints: { adult: false, p2p: false }
};

app.get('/manifest.json', (req, res) => res.json(manifest));

// -----------------------------------------------------------
// PROXY HLS — repassa headers de origem para evitar bloqueio
// -----------------------------------------------------------
app.get('/proxy', (req, res) => {
  const targetUrl = req.query.url;
  const referer = req.query.referer || 'https://1.embedtvonline.com/';
  const origin  = req.query.origin  || 'https://1.embedtvonline.com';

  if (!targetUrl) return res.status(400).send('Missing url');

  let parsed;
  try { parsed = new URL(targetUrl); } catch(e) { return res.status(400).send('Invalid url'); }

  const lib = parsed.protocol === 'https:' ? https : http;

  const options = {
    hostname: parsed.hostname,
    path: parsed.pathname + parsed.search,
    method: 'GET',
    headers: {
      'accept': '*/*',
      'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
      'origin': origin,
      'referer': referer,
      'user-agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/145.0.0.0 Safari/537.36',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'cross-site'
    }
  };

  const proxyReq = lib.request(options, (proxyRes) => {
    const contentType = proxyRes.headers['content-type'] || '';
    const isM3u8 = targetUrl.includes('.m3u8') || contentType.includes('mpegurl');

    if (isM3u8) {
      let body = '';
      proxyRes.on('data', chunk => body += chunk);
      proxyRes.on('end', () => {
        const base = getBaseUrl(req);
        const baseSegment = targetUrl.substring(0, targetUrl.lastIndexOf('/') + 1);

        const rewritten = body.split('\n').map(line => {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith('#')) return line;

          const absoluteUrl = trimmed.startsWith('http') ? trimmed : baseSegment + trimmed;
          return `${base}/proxy?url=${encodeURIComponent(absoluteUrl)}&referer=${encodeURIComponent(referer)}&origin=${encodeURIComponent(origin)}`;
        }).join('\n');

        res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.send(rewritten);
      });
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*');
      if (proxyRes.headers['content-type']) res.setHeader('Content-Type', proxyRes.headers['content-type']);
      proxyRes.pipe(res);
    }
  });

  proxyReq.on('error', (err) => {
    console.error('Proxy error:', err.message);
    res.status(500).send('Proxy error');
  });

  proxyReq.end();
});

// -----------------------------------------------------------
// CATALOG
// -----------------------------------------------------------
function buildMetas(list) {
  return list.map(ch => ({
    id: ch.id, type: 'tv', name: ch.name,
    poster: ch.logo || placeholder(ch.name),
    background: ch.background || ch.logo || placeholder(ch.name),
    description: ch.description || 'Canal ao vivo',
    logo: ch.logo || '',
    genres: ch.genres || ['Ao Vivo']
  }));
}

app.get('/catalog/tv/lives-catalog.json', (req, res) => res.json({ metas: buildMetas(channels) }));

app.get('/catalog/tv/lives-catalog/search=:query.json', (req, res) => {
  const q = req.params.query.toLowerCase();
  res.json({ metas: buildMetas(channels.filter(ch => ch.name.toLowerCase().includes(q))) });
});

// -----------------------------------------------------------
// META
// -----------------------------------------------------------
app.get('/meta/tv/:id.json', (req, res) => {
  const ch = channels.find(c => c.id === req.params.id);
  if (!ch) return res.json({ meta: null });
  res.json({
    meta: {
      id: ch.id, type: 'tv', name: ch.name,
      poster: ch.logo || placeholder(ch.name),
      background: ch.background || ch.logo || placeholder(ch.name),
      description: ch.description || 'Canal ao vivo',
      logo: ch.logo || '',
      genres: ch.genres || ['Ao Vivo'],
      videos: [{ id: ch.id, title: '🔴 Ao Vivo Agora', released: new Date().toISOString() }]
    }
  });
});

// -----------------------------------------------------------
// STREAM
// -----------------------------------------------------------
app.get('/stream/tv/:id.json', (req, res) => {
  const ch = channels.find(c => c.id === req.params.id);
  if (!ch) return res.json({ streams: [] });

  const base = getBaseUrl(req);
  const streams = [];

  for (const s of ch.streams) {
    if (s.type === 'hls' || s.type === 'm3u8') {
      const referer = s.referer || 'https://1.embedtvonline.com/';
      const origin  = s.origin  || 'https://1.embedtvonline.com';
      const proxyUrl = `${base}/proxy?url=${encodeURIComponent(s.url)}&referer=${encodeURIComponent(referer)}&origin=${encodeURIComponent(origin)}`;
      streams.push({ url: proxyUrl, title: s.label || '🔴 Ao Vivo', behaviorHints: { notWebReady: false } });
    } else if (s.type === 'iframe') {
      streams.push({ externalUrl: `${base}/player/${ch.id}/${encodeURIComponent(s.url)}`, title: s.label || '🔴 Ao Vivo (Player)' });
    } else if (s.url) {
      streams.push({ url: s.url, title: s.label || '🔴 Ao Vivo' });
    }
  }

  res.json({ streams });
});

// -----------------------------------------------------------
// PLAYER PAGE
// -----------------------------------------------------------
app.get('/player/:id/:iframeUrl', (req, res) => {
  const iframeUrl = decodeURIComponent(req.params.iframeUrl);
  const ch = channels.find(c => c.id === req.params.id) || {};
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<style>*{margin:0;padding:0}html,body{width:100vw;height:100vh;background:#000;overflow:hidden}iframe{width:100%;height:100%;border:none}</style>
</head><body><iframe src="${escapeHtml(iframeUrl)}" allow="autoplay;fullscreen;encrypted-media" allowfullscreen></iframe></body></html>`);
});

// -----------------------------------------------------------
// HOME
// -----------------------------------------------------------
app.get('/', (req, res) => {
  res.json({ status: 'online ✅', channels: channels.length, install: `stremio://${req.headers.host}/manifest.json` });
});

function placeholder(name) { return `https://placehold.co/300x450/1a1a2e/ffffff?text=${encodeURIComponent(name)}`; }
function getBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host  = req.headers['x-forwarded-host']  || req.headers.host;
  return `${proto}://${host}`;
}
function escapeHtml(str) { return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log(`\n🚀 Addon iniciado! http://localhost:${PORT}`);
  console.log(`   Canais: ${channels.length}\n`);
});
