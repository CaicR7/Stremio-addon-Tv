# 📺 Stremio Addon — Canais Ao Vivo com Iframe

Addon para o Stremio que suporta canais transmitidos via **embed/iframe** (ex: embedtvonline, etc).

---

## ⚙️ Como funciona

O Stremio não aceita iframes diretamente. Este addon resolve isso criando uma
**página HTML** no servidor que embute o iframe em tela cheia. Quando você clica
em "Assistir" no Stremio, ele abre essa página via `externalUrl`.

```
Stremio → addon → /player/canal/URL → página HTML → iframe → live ✅
```

---

## 🚀 Instalação local (PC)

### 1. Instale o Node.js
Baixe em: https://nodejs.org (versão 18 ou superior)

### 2. Instale dependências
```bash
npm install
```

### 3. Configure seus canais
Edite o arquivo `channels.json` (veja seção abaixo)

### 4. Inicie o servidor
```bash
npm start
```

### 5. Instale no Stremio
Abra o Stremio → Configurações → Addons → "Instalar por URL":
```
stremio://localhost:7000/manifest.json
```

---

## 🌐 Deploy online — Railway (RECOMENDADO, gratuito)

Para acessar de qualquer lugar e qualquer dispositivo:

1. Crie conta em https://railway.app (free tier disponível)
2. Clique em **"New Project" → "Deploy from GitHub repo"**
   - Ou use **"Deploy from local"** e arraste esta pasta
3. Aguarde o deploy (1-2 min)
4. Pegue a URL gerada (ex: `https://meu-addon.up.railway.app`)
5. Instale no Stremio:
   ```
   stremio://meu-addon.up.railway.app/manifest.json
   ```

> **Alternativas gratuitas:** Render.com, Fly.io, Koyeb.com

---

## 📝 Como editar channels.json

### Canal com iframe (seu caso principal)
```json
{
  "id": "live_espn",
  "name": "ESPN",
  "description": "ESPN ao vivo",
  "logo": "https://link-da-logo.png",
  "background": "https://link-do-background.png",
  "genres": ["Esportes", "Ao Vivo"],
  "streams": [
    {
      "type": "iframe",
      "url": "https://1.embedtvonline.com/espn/",
      "label": "🔴 ESPN Ao Vivo"
    }
  ]
}
```

### Canal com múltiplas fontes (iframe + HLS de backup)
```json
{
  "id": "live_multicanal",
  "name": "Meu Canal",
  "streams": [
    {
      "type": "iframe",
      "url": "https://site-embed.com/canal/",
      "label": "🔴 Player 1"
    },
    {
      "type": "iframe",
      "url": "https://outro-embed.com/canal/",
      "label": "🔴 Player 2 (backup)"
    },
    {
      "type": "hls",
      "url": "https://stream.url/live.m3u8",
      "label": "🔴 HLS Direto"
    }
  ]
}
```

### Canal com stream m3u8 direto
```json
{
  "id": "live_hls",
  "name": "Canal HLS",
  "streams": [
    {
      "type": "hls",
      "url": "https://seu-servidor.com/live/stream.m3u8",
      "label": "🔴 Ao Vivo HD"
    }
  ]
}
```

---

## 📁 Estrutura de arquivos

```
stremio-addon/
├── index.js        ← servidor principal (não precisa editar)
├── channels.json   ← EDITE AQUI: seus canais e streams
├── package.json
└── README.md
```

---

## 🔧 Variáveis de ambiente

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PORT`   | 7000   | Porta do servidor |

---

## ❓ FAQ

**O Stremio não abre o player?**
O tipo `iframe` usa `externalUrl`, que abre no navegador padrão. Aceite quando o Stremio perguntar.

**Posso ter vários embeds para o mesmo canal?**
Sim! Adicione múltiplos objetos no array `streams` do canal.

**Como achar a URL do iframe?**
Inspecione o elemento no site (F12) e copie o atributo `src` do `<iframe>`.
