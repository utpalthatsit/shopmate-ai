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

## Production setup

1. Run the base tables and RLS policies from the Supabase SQL Editor.
2. Run [schema.sql](schema.sql) to add stock quantities, orders, order items, invoices, and secure stock reduction.
3. In Supabase Authentication, enable Email provider and keep Confirm email enabled.
4. Configure a custom SMTP provider such as Resend under Project Settings -> Authentication -> SMTP Settings.
5. Add `http://localhost:55467/` to Authentication -> URL Configuration while testing locally.
6. Replace the demo `localStorage` flow in `shop.js` and `app.js` with Supabase reads/writes before public deployment.

## What still needs your account access

- Run `schema.sql` in your Supabase project.
- Configure SMTP credentials without sharing them in chat.
- Deploy the static files to Netlify, Vercel, or another HTTPS host.
- Add an Edge Function for server-side order creation and the real AI provider key.
- Add your Google OAuth credentials if Google login is required.

The demo mode remains available for testing without email authentication. It uses localStorage intentionally and should not be used as the production data source.
