# Engineering Fabrication Hub — secure activation and operating guide

Status: **source implemented, external services NOT automatically activated or deployed**. `firebase deploy --only hosting` uploads web pages only, not these new Cloud Functions. All payment and fabrication amounts here are preliminary operator-configurable settings. Review compliance, pricing, refunds, privacy, and upload processes before launch.

## What is implemented

- Existing Engineering Studio retains unrestricted local CAD, load-sweep and OpenSCAD/STL export. Its new *Request fabrication quote* control carries validated plate dimensions to `engineering-fabrication.html`.
- Separate customer self-service hub: build a four-hole plate, import STL/OBJ/GLB for local WebGL inspection, analyze approximate mesh boundaries/degenerates (non-certified), submit PDF, 3MF, STEP/STP, SCAD, DXF and other permitted files for review, track quote status.
- **Server-side** credit wallet: three one-time free credits per verified Firebase Auth UID; one credit per hosted AI request; fixed proposed starter pack (10 / KSh 250) and maker pack (50 / KSh 1,000). Set intended prices in `functions-engineering/core.mjs` and matching presentation before deploying the merchant's live payment credentials.
- AI review or server-validated editable plate dimensions from `gemini-2.5-flash` with an authorized service key. Model failures refund reservations and stale reservations are reconciled. No API key in the browser.
- Paystack transaction initialization, HMAC-SHA512 webhook, server-side reference/amount/currency/status verification, idempotent transactional credit settlement. No free credits on client redirect alone.
- Owner-scoped draft creations and authenticated binary uploads to a **separate engineering folder within a configured bucket**. Upload limit 15 MB; no public Firestore/Storage security rule changes. Uploads are unscanned and need safe operator review.
- Operator-only queue, quote decisions and temporary download links, restricted to verified users with the `engineering_admin` Firebase custom claim.
- No fabrication scheduling, machinery activation, automatic bill, stock reservation, CAD/FEM certification, AI-driven manufacturing authorization or guaranteed printing turnaround.


## Local sculpting and 3D mesh editing (browser-only)

The Fabrication Hub now offers interactive mesh editing without sign-in or AI credits. Start with a **sphere, box, cylinder or generated four-hole mounting plate**, or open an uploaded **STL, OBJ or self-contained GLB** file. The workbench uses the same pinned Three.js runtime for OrbitControls, TransformControls, STLExporter and model loaders.

- **Object editing:** translate, rotate or scale with axis gizmos.
- **Sculpt brushes:** inflate, deflate, smooth, flatten and grab/drag with adjustable radius and strength; optional mirror symmetry about the mesh's local X axis.
- **Edit history:** up to 12 undo states, redo, reset to imported/pristine geometry.
- **Export:** local binary STL download or explicit **Use edited STL for quote**. Edited files are never uploaded automatically; selecting the edited export for a quote replaces the pending source design only until a further edit occurs.
- **Inspection:** refresh the existing approximate triangle topology report after each completed edit. A 150,000-vertex cap on brushes and a 15 MB uploaded STL limit protect browser memory and backend limits. Over-limit meshes can still use object transform tools and local download.
- **File formats:** STL is a triangle mesh format. When converting a GLB/OBJ to STL, materials, UVs, colors, rigging and textures are not preserved. STEP/BREP and SCAD parameter trees are **not** directly editable in the sculpt canvas; use FreeCAD/OpenSCAD or compatible tools to edit source CAD.
- **Manufacturing caveat:** brush edits can create holes, self-intersections, non-manifold topology or lost dimensional precision. The local mesh heuristic is not a fabrication readiness certificate. Confirm units, watertightness, fit and tolerances before submitting.

The sculpt implementation uses the official open-source [Three.js](https://github.com/mrdoob/three.js) geometry, raycasting, [TransformControls](https://threejs.org/docs/pages/TransformControls) and STLExporter, plus custom local brush algorithms for welded duplicate vertices and neighbor smoothing. Additional reference: [marmelab/sculpt-3D](https://github.com/marmelab/sculpt-3D) (MIT). That reference implementation is **not bundled or copied** into TeknTandao.

## Required Firebase setup

1. Use a Firebase project with billing and required APIs enabled for Cloud Functions 2nd gen, Cloud Storage, Firestore, Firebase Auth and App Check. Enable Google sign-in in Firebase Authentication, authorize your website domains, and configure App Check with a genuine site key.
2. In `assets/js/commerce-config.js`, set the project's **public** Firebase web configuration (apiKey, authDomain, projectId, storageBucket, messagingSenderId and appId). Those are project identifiers, **not** server secrets. In `assets/js/engineering-fabrication-config.js`, set `appCheckSiteKey` to your **public** reCAPTCHA v3 site key. Do **not** commit private keys.
3. Set the nonsecret Functions parameter `ENGINEERING_STORAGE_BUCKET` to the exact authorized Firebase Storage bucket, e.g. in a codebase-specific `.env.tekntandao` excluded from Git, or when prompted by Firebase CLI. Never guess a bucket name.
4. Store the two secrets with Firebase CLI (separately from GitHub):

   `firebase functions:secrets:set ENGINEERING_GEMINI_API_KEY`

   `firebase functions:secrets:set ENGINEERING_PAYSTACK_SECRET_KEY`

   Do not use an existing unrelated payment secret; this service has its own merchant-scoped key.

5. From a current checkout of the repo, install dependencies:

   `npm --prefix functions-engineering install`

   `npm --prefix functions-engineering run check`

   `firebase deploy --only functions:engineering,firestore:indexes --project tekntandao`

   After backend activation, deploy the frontend and Hosting upload rewrite:

   `firebase deploy --only hosting --project tekntandao`

   Hosting quota may need cleanup if Firebase returns HTTP 429. The new HTTPS function must be deployed before the Hosting rewrite can process uploads.

6. Set **Paystack** webhook URL in your merchant dashboard to the HTTPS endpoint for the deployed function:

   `https://europe-west1-tekntandao.cloudfunctions.net/engineeringPaystackWebhook`

   Confirm the actual deployed URL in the Functions dashboard. Test in provider sandbox; verify credit grant exactly once for both webhook and callback confirmation. Confirm account supports KES before enabling live checkout.
7. Assign `engineering_admin: true` **only** to authorized TeknTandao operators using Firebase Admin SDK via a secure operator environment; preserve their other custom claims. Require operator re-login/ID-token refresh.
8. Check Cloud Storage bucket permissions and any required service-account signing permission for short-lived download links. File uploads run through the server-authorized `/api/engineeringUpload` endpoint; this feature deliberately does **not** replace any existing Cloud Storage rules protecting other apps.
9. Carry out a private-data impact review, define file retention/deletion policy, implement malware scanning and any production-specific data residency requirements. Until scanning exists, quarantine uploads operationally and do not execute macros, scripts, SCAD files, or unsafe documents.
10. Configure merchant policies for AI fees, refund/chargeback reconciliations, tax invoices, quote validity, cancellation, customer communications, safe fabrication practices and Kenyan consumer/privacy compliance. Monitor runaway cost and unusual multi-account credit grants.

## Open-source dependencies and reference projects

| Project | Role | Upstream | Status in our site |
| --- | --- | --- | --- |
| Three.js | Browser 3D CAD view, STL/OBJ/GLB loaders, orbit controls | https://github.com/mrdoob/three.js | Integrated |
| OpenSCAD | Editable parametric code export | https://github.com/openscad/openscad | Export integrated; editor external |
| replicad / OCCT | BREP workflow and production-grade solid modelling | https://github.com/sgenoud/replicad | External resource; not bundled |
| ToubkalCAD | Browser OCCT parametric CAD | https://github.com/ToubkalCAD/ToubkalCAD | External resource; not bundled |
| FreeCAD | Native CAD and technical drawings | https://github.com/FreeCAD/FreeCAD | External resource |
| KiCad | PCB CAD manufacturing toolchain | https://github.com/KiCad/kicad-source-mirror | External resource |
| MeshRight | Mesh repair, **GPLv3** | https://github.com/Huzy85/MeshRight | External resource; not copied |
| Webots | Robot simulation | https://github.com/cyberbotics/webots | External resource |
| OpenFOAM | CFD solver, **GPL** | https://github.com/OpenFOAM/OpenFOAM-dev | External resource |

The link directory is **not** an automatic integration, and OpenFOAM/MeshRight GPL code is not copied into the commercial frontend. Check repository licences before commercial bundling, adaptation or redistribution.

## Testing and limitations

`node --test functions-engineering/tests/core.test.mjs tests/engineering-fabrication.test.cjs tests/engineering-mesh-inspection.test.mjs`

These are numerical/contract and static UI/security tests. A production launch additionally requires **Firebase Emulator integration tests**, end-to-end auth/App Check, real Paystack sandbox verification, upload/download isolation tests, file malware screening, model provider evaluation, and actual fabrication-partner onboarding. No cloud credentials, payment history or test merchant account have been created by committing code.

## Data handling

- Draft and quote data: private server-managed `engineeringProjects`; wallet `engineeringWallets`; AI jobs `engineeringAiJobs/{uid}/requests/{requestId}`; transactions `engineeringPurchases`.
- Files: `engineeringFiles/{uid}/{projectId}/design.{ext}` in the *configured* Cloud Storage bucket. Metadata marked unscanned and project must be owner-created, type `upload`, status `draft`.
- Client never receives Paystack/AI secrets, never writes a credit balance, and cannot directly change manufacturing quote status. Operators can view files via time-limited signed URLs only with privileged claims.

## Pricing and operations note

The credit packages are implementation defaults, **not approved public commercial terms**. Review margins, payment processing fees, model inference costs, tax obligations and free-credit abuse protections before activating checkout. The fabrication quote is **independent** of AI credits and must be approved with a separate sales/purchase contract.


## Tripo AI v3 mesh generation — requires deployment and provider activation

The Fabrication Hub offers text-to-model and PNG/JPEG image-to-model generation using Tripo v3.1, with private asynchronous jobs, a server-side API secret and an independent 10-credit charge per generation. This charge is an initial operator-configurable value, not a statement of provider pricing. Check Tripo API fees and Kenyan credit-package economics before enabling real customers. The three introductory AI credits remain usable for the existing Gemini design assistant but are insufficient for a Tripo request.

Store the API key using firebase functions:secrets:set ENGINEERING_TRIPO_API_KEY. Configure ENGINEERING_STORAGE_BUCKET, Firebase Auth and App Check, then deploy the engineering Functions and Hosting rewrite. A hosting-only deploy is insufficient. Reference images and prompts are transmitted to Tripo only after explicit consent. Model results are stored privately at engineeringTripoModels/{uid}/{jobId}/model.glb; an authenticated owner-scoped download endpoint returns GLB files up to 15 MB. Failed generations and unavailable results trigger idempotent credit refunds. The browser can resume its most recent job within the same browser session, then open GLB in the existing free sculpt editor. Edited STL selection and actual fabrication submission remain explicit separate steps.

Outputs are approximate triangle meshes, generated without texture maps to control size; not validated BREP CAD or manufacturing geometry. Validate actual scale, watertightness, wall thickness, safety and fit before manufacturing. Test provider results, Firebase emulator flows, quotas and credit economics before go-live. Reference https://developers.tripo3d.ai/en/docs/quick-start


## Combined Engineering and Fabrication workspace

All core Engineering Studio and Engineering Fabrication tools now appear on `engineering.html`: design briefs, estimates, CAD and beam approximations, simulators, local WebLLM guidance, hosted Gemini assistance, Tripo 3D generation, local mesh sculpting and private fabrication quotations. The site menu shows only the unified Engineering & Prototyping entry. The old fabrication page is a redirect preserving known fragment destinations and plate referral query parameters.

The sole visible parametric plate form in the CAD workbench updates the quote form through browser-only validated geometry synchronization. Gemini-drafted dimensions and legacy parameterized links update that same design source. All edits and simulation remain distinct from uploading; fabrication requests continue to require user consent and a human review. Unique open-source CAD tools from the former fabrication directory have been moved into the Engineering tool directory, avoiding duplicate FreeCAD/OpenSCAD links. No live service activation is implied by this UI consolidation.


## Unified engineering dashboard

`engineering.html` is a single responsive dashboard with seven views: Overview; Calculators & Simulations; Parametric CAD & STL; AI Design; 3D Sculpting & Imports; Fabrication Quotation; and Projects & Credits. These are navigation views of one existing application, not duplicate projects or separate products. The browser relocates the existing engineering form controls, CAD viewport, WebLLM, Gemini/Tripo workflows, sculpt canvas, wallet, and private project list into focused panels without cloning or re-registering backend services. The Overview live summaries read the existing server-backed balance and private project list; they do not synthesize credit transactions. Old deep links, fabrication quote referrals, existing auth, payments, explicit uploads and human manufacturing review remain unchanged. Clicking Tripo 'Open in sculpt editor' now exposes the sculpting panel before loading its GLB preview, so WebGL sizing works. No provider secret or paid credit is consumed by opening the dashboard.

Credit package checkout cards live within the Projects & Credits tab alongside server-verified account information; these are the same existing secure Paystack buttons, not new payment implementations.


## Design Intelligence: real geometric preflight and local design revisions

A new deterministic, dependency-free `engineering-design-intelligence-core.mjs` validates parametric plate dimensions, evaluates hole-to-edge ligaments and clear hole spacing, and gives process-specific DFM screening advice for CNC, 3D printing, laser cutting, PCB assembly and unspecified processes. Warnings include deep drilling aspect ratio, print orientation/material mismatch, unavailable tolerancing and missing structural qualification. The report is intentionally never an approval, certified FEM, toolpath, price or warranty of machine capacity. It includes qualified reference URLs from NIST and Autodesk.

The CAD workbench now supports up to 12 local plate revisions (strictly validated schema, unique identifiers and guarded imports), restores full CAD and illustrative load, compares dimensions and idealized volume, exports reproducible revision archives and local engineering preflight evidence as JSON, and can append a concise preflight summary into the quotation notes only at the user’s request. The browser does not store data between sessions unless the user opts in, and browser history stores only geometric inputs, selected materials, process and illustrative load—not AI prompts, contact details, original uploaded files or payment credentials. No server deployment or third-party API calls are needed for Design Intelligence.


### Constrained local design-space exploration

The CAD Design Intelligence section includes a design-space explorer evaluating up to seven thickness perturbations using the independently tested beam simulation. It computes nominal mass, tip deflection and stress-to-yield margins against user-configured screening criteria, with a button to apply a candidate to the shared CAD/simulation/quotation input. It is a bounded study, not an optimizer, formal FEA, CNC toolpath or certification. Zero-force inputs cannot generate positive strength-screening recommendations.


## Unified Engineering Pipeline and one shared viewport (Nov 2026)

The Engineering Hub has a single Engineering Pipeline sidebar item with five stages: Brief, Model, Refine, Analyze, Deliver. One persistent central viewport area displays the active parametric, primitive, imported, AI-generated, or sculpted model; the original calculators, CAD controls, SCAD export, AI workflows, simulation controls, DFM preflight, Tripo generation and fabrication quote form are now stage-specific inspector tools. The original separate CAD WebGL renderer is disabled in pipeline mode. A single sculpt-capable renderer occupies the central fab-preview canvas and can recycle its WebGL context when the geometry source changes. Camera controls, mesh inspection, mesh edits and STL exports refer to this active scene.

An unchanged parametric plate can display a non-destructive color overlay driven by the existing simplified beam model. This is a surrogate, not general finite-element analysis. Imported, AI-generated, primitive and sculpt-edited meshes are visibly marked as not having a validated structural simulation; stale plate-specific simulation results and DFM screens are hidden in those cases.

The active model has explicit source provenance. Parametric field edits only regenerate an unmodified parametric model. Replacing a sculpted or imported mesh with the parametric plate requires an explicit action. Tripo GLB generation loads into the central scene rather than a separate editor page. Manufacturing file selection remains explicit, and the submission handler rejects a parametric-plate request when the active model is a mesh. Existing signed-in consent, server-backed payments and human quotation review remain separate. This change is not a BREP/STEP modeller, certified FEA solver, automated manufacturing system, or live deployment verification. Existing deep links route to relevant pipeline stages.


### Persistent WebGL renderer and explicit physical mesh units

The pipeline viewport now maintains a persistent Three.js renderer, camera and orbit controls while swapping the active model; expensive GPU contexts are not recreated on routine plate parameter updates. Mesh replacement disposes obsolete sculpt-editor handlers, graphics geometry and materials. File imports use monotonically increasing request tickets to reject older asynchronous file reads/GLB parses after a newer import or primitive is selected, and new models undergo finite-coordinate, vertex-budget and bounded-size checks before replacing the last valid scene.

Imported STL/OBJ/GLB and Tripo AI GLB coordinates are not assumed to represent millimetres. Users must explicitly select source units (mm, cm, m or inches), re-import the original model, and convert geometry to the shared millimetre basis before a mesh may be selected for fabrication. A measured X/Y/Z bounding-box summary and vertex count appear beside the central viewport. Reinterpretation of previously sculpted geometry requires confirmation, because it resets edits. Unit conversion clears any previously selected fabrication upload and requires explicit STL export/selection again; this prevents mistakenly submitting the pre-conversion file. The original parametric plate and locally created primitives use millimetres by design. Unit declarations are user supplied, not certified measurements. No uploaded data is transmitted during unit verification.

A browser-level interactive model-viewer acceptance check is still needed before claiming full production readiness.


### Non-destructive model inspection controls

The single Engineering viewport also supports material X-ray transparency, a selectable X/Y/Z clipping plane with an interactive position slider, wireframe/solid views, and an explicit local PNG snapshot export. These use the active shared Three.js scene; clipping and opacity affect only appearance, never STL/OBJ geometry or the plate's calculation model. Sectioning does not cap open cross-sections or compute an actual manufacturing cut, and screenshots are visual evidence, not dimensioned or certified drawings. Inspection controls reset whenever a different active model loads, avoiding misleading carry-over.
