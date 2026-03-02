const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

const channels = require('./channels.json');

// -----------------------------------------------------------
// MANIFESTO
// -----------------------------------------------------------
const manifest = {
  id: 'com.meucanal.lives',
  version: '1.0.0',
  name: '📺 Meus Canais Ao Vivo',
  description: 'Seus canais ao vivo personalizados no Stremio',
  resources: ['catalog', 'meta', 'stream'],
  types: ['tv'],
  catalogs: [
    {
      type: 'tv',
      id: 'lives-catalog',
      name: '📺 Ao Vivo',
      extra: [{ name: 'search', isRequired: false }]
    }
  ],
  idPrefixes: ['live_'],
  behaviorHints: { adult: false, p2p: false }
};

app.get('/manifest.json', (req, res) => res.json(manifest));

// -----------------------------------------------------------
// CATALOG
// -----------------------------------------------------------
function buildMetas(list) {
  return list.map(ch => ({
    id: ch.id,
    type: 'tv',
    name: ch.name,
    poster: ch.logo || placeholder(ch.name),
    background: ch.background || ch.logo || placeholder(ch.name),
    description: ch.description || 'Canal ao vivo',
    logo: ch.logo || '',
    genres: ch.genres || ['Ao Vivo']
  }));
}

app.get('/catalog/tv/lives-catalog.json', (req, res) => {
  res.json({ metas: buildMetas(channels) });
});

app.get('/catalog/tv/lives-catalog/search=:query.json', (req, res) => {
  const q = req.params.query.toLowerCase();
  const filtered = channels.filter(ch =>
    ch.name.toLowerCase().includes(q) || (ch.description || '').toLowerCase().includes(q)
  );
  res.json({ metas: buildMetas(filtered) });
});

// -----------------------------------------------------------
// META
// -----------------------------------------------------------
app.get('/meta/tv/:id.json', (req, res) => {
  const ch = channels.find(c => c.id === req.params.id);
  if (!ch) return res.json({ meta: null });

  res.json({
    meta: {
      id: ch.id,
      type: 'tv',
      name: ch.name,
      poster: ch.logo || placeholder(ch.name),
      background: ch.background || ch.logo || placeholder(ch.name),
      description: ch.description || 'Canal ao vivo',
      logo: ch.logo || '',
      genres: ch.genres || ['Ao Vivo'],
      videos: [{
        id: ch.id,
        title: '🔴 Ao Vivo Agora',
        released: new Date().toISOString()
      }]
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
    if (s.type === 'iframe') {
      // Serve uma página HTML fullscreen com o iframe embutido
      // O Stremio vai abrir via externalUrl no navegador/WebView
      const playerUrl = `${base}/player/${ch.id}/${encodeURIComponent(s.url)}`;
      streams.push({
        externalUrl: playerUrl,
        title: s.label || '🔴 Ao Vivo (Player)',
        description: 'Abre o player ao vivo'
      });
    } else if (s.type === 'hls' || s.type === 'm3u8') {
      streams.push({
        url: s.url,
        title: s.label || '🔴 Ao Vivo HLS',
        behaviorHints: { notWebReady: false }
      });
    } else if (s.url) {
      streams.push({
        url: s.url,
        title: s.label || '🔴 Ao Vivo'
      });
    }
  }

  res.json({ streams });
});

// -----------------------------------------------------------
// PLAYER PAGE — HTML com iframe fullscreen
// -----------------------------------------------------------
app.get('/player/:id/:iframeUrl', (req, res) => {
  const iframeUrl = decodeURIComponent(req.params.iframeUrl);
  const ch = channels.find(c => c.id === req.params.id) || {};

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${escapeHtml(ch.name || 'Ao Vivo')}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body {
      width: 100vw; height: 100vh;
      background: #000;
      overflow: hidden;
      font-family: sans-serif;
    }
    iframe {
      width: 100%;
      height: 100%;
      border: none;
      display: block;
    }
    #loading {
      position: fixed; inset: 0;
      display: flex; align-items: center; justify-content: center;
      flex-direction: column; gap: 12px;
      background: #000; color: #fff; z-index: 10;
      font-size: 18px;
    }
    #loading .dot {
      width: 12px; height: 12px; background: #e53;
      border-radius: 50%; animation: pulse 1s infinite;
      display: inline-block; margin-right: 8px;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.4; transform: scale(0.8); }
    }
  </style>
</head>
<body>
  <div id="loading">
    <div><span class="dot"></span>${escapeHtml(ch.name || 'Canal')}</div>
    <div style="font-size:13px;color:#888">Carregando transmissão ao vivo...</div>
  </div>
  <iframe
    id="player"
    src="${escapeHtml(iframeUrl)}"
    allow="autoplay; fullscreen; encrypted-media; picture-in-picture"
    allowfullscreen
    frameborder="0"
    onload="document.getElementById('loading').style.display='none'"
  ></iframe>
</body>
</html>`);
});

// -----------------------------------------------------------
// HOME / STATUS
// -----------------------------------------------------------
app.get('/', (req, res) => {
  const base = getBaseUrl(req);
  res.json({
    status: 'online ✅',
    addon: manifest.name,
    channels: channels.length,
    install_url: `stremio://${req.headers.host}/manifest.json`,
    manifest: `${base}/manifest.json`
  });
});

// -----------------------------------------------------------
// HELPERS
// -----------------------------------------------------------
function placeholder(name) {
  return `https://placehold.co/300x450/1a1a2e/ffffff?text=${encodeURIComponent(name)}`;
}

function getBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || req.protocol;
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${proto}://${host}`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// -----------------------------------------------------------
// START
// -----------------------------------------------------------
const PORT = process.env.PORT || 7000;
app.listen(PORT, () => {
  console.log(`\n🚀 Addon iniciado!`);
  console.log(`   Local:   http://localhost:${PORT}`);
  console.log(`   Instalar: stremio://localhost:${PORT}/manifest.json`);
  console.log(`\n   Canais carregados: ${channels.length}`);
  console.log(`   Edite channels.json para adicionar mais\n`);
});
