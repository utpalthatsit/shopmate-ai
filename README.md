# Shopmate AI

A dependency-free MVP prototype for the AI shop assistant described in the PRD.

## Run locally

```powershell
npm run dev
```

Open the local URL printed by `serve` to view the owner dashboard. The dashboard uses localStorage for its prototype data. `widget.js` is standalone and can be embedded with:

```html
<script src="./widget.js" data-shop-id="maison-miro-84d2" defer></script>
```

## Supabase integration points

The UI is ready to replace the local store with Supabase Auth, `shops`, `products`, `faqs`, `chat_sessions`, and `messages`. The embed snippet currently uses the future CDN URL and the chat response is intentionally simulated until an Edge Function and model provider are configured.
