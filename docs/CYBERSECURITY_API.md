# Authenticated cybersecurity API / execution boundary

This module provides authenticated asset registration, DNS TXT ownership checks, request creation and administrator approval. It does **not** invoke scans. Public Firebase HTTP invoker is required for browser access; every route checks a Firebase ID token and data ownership. Configure the `securityAdmin` **custom claim** using privileged Firebase Admin tooling, never a client-supplied role. All collections are inaccessible to the Firestore browser SDK under existing rules.

Routes under `/api/security`:
- POST `/assets` JSON `{"domain":"example.com"}` returns a challenge. Publish the exact TXT value at `_tekntandao-verify.example.com`.
- POST `/assets/:id/verify` resolves DNS and verifies record.
- GET `/assets` lists user's assets, omitting challenge secrets.
- POST `/assessments` JSON `{"assetId":"...","type":"web"}` creates a **non-executing** request.
- GET `/assessments` lists user's requests.
- POST `/assessments/:id/approve` requires a `securityAdmin` Firebase custom claim and marks request `approved_not_scheduled`.

All requests require `Authorization: Bearer <Firebase ID token>`. DNS TXT verification proves domain control only at the point of verification, **not ongoing authorization to run intrusive tests**. Before any actual execution, implement domain revalidation, scope definitions, network resolution and IP safelists, DNS-rebinding controls, tenant quotas, scan-window enforcement, written assessment authorization and human approval.

## Separate scanner control plane — NOT CONNECTED
Use privately networked, non-root worker containers with egress firewall and strict approved IP allowlist. Pin immutable image digests. Scan workers must fetch approved jobs with worker identity, not read client-controlled commands. Tool adapters (Nmap, Nuclei, ZAP, Trivy) must enforce non-destructive profiles, CPU/memory limits and timeouts. Integrate PentAGI only as a policy-constrained planning service. Never give LLM agents direct unfiltered shell/target access.

## Deployment
1. Review PR, run `node --check functions/security.js`, then Firebase emulator tests.
2. Ensure Firebase project billing and Cloud Functions deployment access.
3. Deploy `firebase deploy --only functions:securityApi,hosting` from approved branch **after merging**, with proper auth config; check your Firebase CLI supports function targeting. Existing commerce functions remain untouched.
4. Add user sign-in and token-backed fetch requests to the portal before accepting real client submissions. Current portal continues to send WhatsApp onboarding requests only.
5. Provision separate worker platform and secrets once authorized; no worker deployment is included in this change.

## Important
Security controls described for future scanner execution have **not** been implemented. No live scanning or LLM agent connection is represented as operational.
