# Risikozone Ringparken Beta — 4200 Slagelse

Webapplikation til GIS-risikokortlægning af miljøgifte (asbest, PCB, bly, SCCP/MCCP, PAH, HP14), bygningsfysisk eksponering, borgertilsyn, LCA/klima-konsekvensberegning og LAR-skybrudstilpasning under nedrivning og omdannelse i Ringparken, Slagelse.

## Lokal udvikling & Verifikation

```bash
npm install
npm run dev      # Starter Express + Vite middleware på port 3000
npm test         # Kører deterministiske enhedstests (dispersion, riskEngine, climateLcaEngine)
npm run lint     # TypeScript typecheck (tsc --noEmit)
npm run build    # Bygger produktions-bundle til dist/
```

Verificér efter build, at ingen Gemini API-nøgler er indlejret i klient-bundlet:

```bash
grep -r "GEMINI_API_KEY" dist/
grep -r "AIza" dist/
# GEMINI_API_KEY må aldrig forekomme i dist/.
# Hvis Google Maps er aktiveret via VITE_GOOGLE_MAPS_API_KEY, vil den offentlige browser-nøgle indgå i klient-bundlet og SKAL være HTTP-referrer-begrænset i Google Cloud Console.
```

## Produktions-tjekliste (Ekstern hosting uden for Google AI Studio)

Ved ekstern udrulning på f.eks. Google Cloud Run, Vercel eller Netlify skal nedenstående sikkerhedskrav være opfyldt før go-live:

- **(a) Aktivér backend-proxy i klienten:**
  Sæt `VITE_USE_BACKEND_PROXY=true` i produktionsmiljøets build-/environment-variabler, så al multimodal analyse i browseren routes sikkert gennem server-endpointet `/api/gemini` (`api/gemini.ts` i serverless-miljøer eller Express-ruten i `server.ts`).

- **(b) Konfigurer `GEMINI_API_KEY` udelukkende som server-secret:**
  Opret `GEMINI_API_KEY` som en ren server-side secret i hostingplatformens Secret Manager / Environment Variables. Brug **ALDRIG** `VITE_GEMINI_API_KEY` eller `VITE_API_KEY`, da alle `VITE_`-variabler bakes direkte ind i det offentlige JavaScript-bundle.

- **(c) Aktivér forbrugs-loft og API-begrænsninger:**
  1. Aktivér et fast månedligt forbrugs-loft (**Monthly Spend Cap**) i Google AI Studio / Google Cloud Billing, så uventede spidsbelastninger ikke medfører ukontrollerede udgifter.
  2. Begræns API-nøglen i Google Cloud Console (**API & Services → Credentials → API restrictions**) til udelukkende at gælde **Generative Language API** (`generativelanguage.googleapis.com`).
