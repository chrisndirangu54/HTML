# Firebase frontend + Railway Strapi deployment

Firebase Hosting remains the **only** TeknTandao frontend host, configured by `firebase.json` and `.firebaserc`. Do not use Vercel. Existing Firebase Authentication, Functions and payment APIs remain on Firebase.

Railway should host Strapi from the `cms/` directory as a Docker service with managed PostgreSQL, TLS, persistent uploads via external object storage, encrypted backups, monitoring, and authenticated Strapi administration.

## Railway setup
- Import `chrisndirangu54/HTML` using the GitHub connection.
- Set Strapi service root directory `cms`, Dockerfile `Dockerfile`.
- Add managed PostgreSQL to the project and use its internal connection URL as `DATABASE_URL`.
- Configure required secrets from `cms/.env.example` using Railway variables; ensure network and SSL settings match the actual database.
- Configure custom API domain only after Strapi responds healthily.
- Migrate seeded articles and Firestore content after verifying draft/publish behavior; keep current feeds until confirmed.
- Continue using `firebase deploy --only hosting,functions` for approved Firebase app updates, not Railway.

## Security engines
PentAGI, HexStrike, Strix, Shannon, DefectDojo, Faraday and secureCodeBox are not run on Firebase Hosting or assumed to be running on Railway. They require isolated scanning infrastructure, separate accounts/secrets and per-customer authorization. The AI comparison registry does not represent working runtime adapters.

## Free-tier constraints
Railway Free currently includes approximately $1 monthly usage credit after a $5 trial; do not assume it supports seven heavyweight engines. Oracle Cloud Always Free Ampere VM or Google Cloud Run Jobs are alternatives for proof-of-concept compute, with quota/region limitations and controls for abuse. A small K3s deployment may work on an existing owned VPS, but an open-source Kubernetes distribution does not include free hosting.
