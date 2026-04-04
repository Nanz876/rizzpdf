# RizzPDF Mobile App — Design Spec

**Date:** 2026-04-04
**Status:** Approved for implementation
**Repo:** `rizzpdf-mobile` (new, separate from web)

---

## 1. Overview

A React Native (Expo) mobile app for iOS and Android that brings all 16 RizzPDF tools to mobile. Shares the same Clerk authentication and Supabase backend as the web app. Users who subscribe on web get Pro on mobile automatically, and vice versa via RevenueCat entitlement sync.

**Goals:**
- Full tool parity with the web app (all 16 tools)
- All PDF processing is client-side only — files never leave the device
- File-first UX: pick a PDF, then choose what to do with it
- Single subscription works across web and mobile

---

## 2. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | React Native + Expo (SDK 51+) | Fastest path, OTA updates, Expo Router |
| Navigation | Expo Router (file-based) | Consistent with Next.js mental model |
| PDF processing | pdf-lib (direct) | Pure JS, works in RN Hermes runtime unchanged |
| PDF encryption | @pdfsmaller/pdf-encrypt | Uses Web Crypto API, available in Expo |
| PDF thumbnails | react-native-pdf-thumbnail | Wraps native PDFKit/PdfRenderer per platform |
| PDF→JPG output | react-native-pdf (native renderer) | Better quality than JS canvas alternatives |
| File I/O | expo-document-picker, expo-file-system, expo-camera | Standard Expo modules |
| Sharing/output | expo-sharing | Opens native Share sheet |
| Auth | @clerk/clerk-expo | Official Clerk RN SDK |
| Subscriptions | RevenueCat (react-native-purchases) | Handles IAP + syncs entitlements with Supabase |
| Cloud storage | expo-document-picker (iCloud/Drive built-in on device) | No custom integration needed |
| Styling | NativeWind (Tailwind for RN) | Consistent with web codebase patterns |
| Compression helper | JSZip | Pure JS, unchanged from web |

---

## 3. Repository Structure

```
rizzpdf-mobile/
├── app/                        # Expo Router screens
│   ├── (tabs)/
│   │   ├── index.tsx           # Home (file list + Add File)
│   │   ├── history.tsx         # Processed file history
│   │   └── account.tsx         # Auth + subscription
│   ├── tool/
│   │   ├── picker.tsx          # Tool picker (file passed as param)
│   │   └── [tool].tsx          # Tool config + processing + result
│   └── _layout.tsx
├── components/
│   ├── FileCard.tsx            # Recent file row
│   ├── ToolGrid.tsx            # 4×4 tool grid
│   ├── ToolShell.tsx           # Consistent tool screen wrapper
│   ├── PaywallSheet.tsx        # Bottom sheet paywall
│   └── ResultSheet.tsx         # Share/save result bottom sheet
├── lib/
│   ├── pdf-tools-native.ts     # Port of web pdf-tools.ts
│   ├── file-system.ts          # expo-file-system helpers
│   ├── useProStatus.ts         # Pro/bulk/free tier check
│   └── revenue-cat.ts          # RevenueCat init + purchase helpers
├── assets/
└── app.json
```

---

## 4. Navigation (File-First)

**Bottom tab bar — 3 tabs:**

```
[⚡ Tools]  [📂 History]  [👤 Account]
```

**User flow:**

```
Tools tab (Home)
  → recent file tapped       → Tool Picker screen
  → "Add File" tapped        → Add File bottom sheet
      → Browse Files          → expo-document-picker (Files app)
      → Scan Document         → expo-camera (document scan mode)
      → iCloud / Google Drive → expo-document-picker (cloud sources)
  → file selected from sheet → Tool Picker screen

Tool Picker screen
  → shows filename + size at top
  → 4×4 grid of all 16 tools
  → tool tapped              → Tool Config screen

Tool Config screen
  → tool-specific options (mirrors web UI)
  → "Process" button         → processing in-thread (pdf-lib)
  → done                     → Result sheet (bottom sheet overlay)

Result sheet
  → shows before/after stats (size, pages)
  → "Share" → native Share sheet
  → "Save to Files" → expo-file-system save
  → "Done" → back to Home (file added to history)
```

---

## 5. All 16 Tools

Ported from `lib/pdf-tools.ts`. Same logic, different I/O layer.

| Tool | Web function | Notes |
|---|---|---|
| Compress | `compressPDF` | Same quality levels (low/med/high) |
| Split | `splitPDF` | Output: zip of individual pages via JSZip |
| Merge | `mergePDFs` | Multi-file select in picker |
| Rotate | `rotatePDF` | 90/180/270° |
| Watermark | `watermarkPDF` | Full options: text/position/opacity/size/color |
| Page Numbers | `addPageNumbers` | Bottom-left/center/right |
| Protect | `protectPDF` | AES-256 via @pdfsmaller/pdf-encrypt |
| Unlock | `unlockPDF` | Password entry |
| Repair | `repairPDF` | pdf-lib reload + re-save |
| Crop | `cropPDF` | Margin sliders |
| Flatten | `flattenPDF` | Remove form fields |
| PDF→JPG | `pdfToJpg` | react-native-pdf renders each page natively; output as zip |
| JPG→PDF | `jpgToPdf` | expo-image-picker → pdf-lib |
| Word→PDF | (web: server) | **Deferred to v2** — no client-side solution on mobile |
| Redact | `redactPDF` | Black rectangle overlay |
| Resize | `resizePDF` | Page size presets (A4, Letter, etc.) |

> **Word→PDF:** The web version requires a server-side LibreOffice conversion. On mobile there is no viable client-side path. This tool will be hidden in v1 with a "Coming soon" state.

---

## 6. PDF Processing Layer

All processing runs in the React Native JS thread (Hermes). For large files this is blocking — mitigated by showing a progress indicator. A background thread via `react-native-workers` can be added in v2 if needed.

**Replacing web I/O:**

| Web API | Mobile replacement |
|---|---|
| `FileReader.readAsArrayBuffer` | `expo-file-system.readAsStringAsync` (base64) → decode to Uint8Array |
| `URL.createObjectURL` | Write bytes to `FileSystem.cacheDirectory` |
| `<a download>` click | `expo-sharing.shareAsync(localUri)` |
| Canvas API (JPG rendering) | `react-native-pdf-thumbnail` or `react-native-pdf` native renderer |

**Output for multi-file results (Split, PDF→JPG):**
- Multiple output files → JSZip → single `.zip` → share/save

---

## 7. Authentication

- **Clerk React Native SDK** (`@clerk/clerk-expo`)
- Same Clerk instance as web — users share accounts
- Sign-in via email magic link or social (Google/Apple)
- `useUser()` hook available app-wide via ClerkProvider in `_layout.tsx`

**Pro tier check** (`lib/useProStatus.ts`):
```
1. Check AsyncStorage for bulk day pass (`rizzpdf_bulk_until` timestamp)
2. If not found/expired, check Clerk user signed in
3. If signed in, fetch /api/user/subscription from web API
4. If tier === "pro" → isPro = true
5. Else → free tier (3 ops/session, tracked in AsyncStorage)
```

---

## 8. Monetization

**Three tiers (same as web):**

| Tier | Price | Access |
|---|---|---|
| Free | $0 | 3 operations per session |
| Bulk | $1 / 24hr | Unlimited for 24 hours, no account needed |
| Pro | $7/mo | Unlimited, synced across web + mobile |

**Implementation:**
- **RevenueCat** (`react-native-purchases`) manages iOS App Store + Google Play IAP
- RevenueCat webhook → Supabase `subscriptions` table (same table web uses)
- Web Pro subscribers: entitlement synced via Clerk user ID in RevenueCat
- Bulk day pass: stored in AsyncStorage, same logic as web localStorage

**Paywall trigger:** Same as web — after 3rd free operation, `PaywallSheet` bottom sheet appears with two options: Bulk ($1) and Pro ($7/mo).

---

## 9. Free Tier Tracking

- AsyncStorage key: `rizzpdf_free_count` (integer, reset each app session)
- AsyncStorage key: `rizzpdf_bulk_until` (timestamp ms, same as web)
- Pro check via RevenueCat entitlement (cached locally, refreshed on app foreground)

---

## 10. Error Handling

- Processing errors: shown inline on Result sheet with plain-English message
- Auth errors: silent fail → user stays on free tier
- File I/O errors: toast notification via `react-native-toast-message`
- Network errors (subscription check): fail open → treat as free tier (don't block usage)

---

## 11. Out of Scope (v1)

- Word→PDF conversion
- Background processing (large files block UI — acceptable for v1)
- Offline subscription verification (always online check)
- iPad-specific layout optimizations
- Push notifications
- File sync / cloud backup of processed files

---

## 12. Open Questions (deferred)

- **Apple review:** PDF tools with encryption may require export compliance documentation
- **RevenueCat ↔ Stripe sync:** Manual webhook mapping needed to sync web Stripe subscriptions to RevenueCat entitlements — implementation detail for auth/billing phase
