# RizzPDF Mobile App — Design Spec

**Date:** 2026-04-04
**Status:** Approved for implementation
**Repo:** `rizzpdf-mobile` (new, separate from web)

---

## 1. Overview

A React Native (Expo) mobile app for iOS and Android that brings 15 active RizzPDF tools to mobile (Word→PDF deferred to v2 — no client-side path exists). Shares the same Clerk authentication and Supabase backend as the web app.

**v1 Goals:**
- 15 active tools (Word→PDF shown as disabled "Coming soon")
- All PDF processing is client-side only — files never leave the device
- File-first UX: pick a PDF, then choose what to do with it
- Mobile IAP (RevenueCat) subscription works independently
- Web Pro subscribers recognized on mobile via Clerk user ID lookup (v1 — see Section 8)

**v2 Goals (out of scope for this spec):**
- Full bidirectional Stripe ↔ RevenueCat entitlement sync
- Word→PDF conversion
- Background thread processing for large files

---

## 2. Tech Stack

| Layer | Choice | Reason |
|---|---|---|
| Framework | React Native + Expo (SDK 51+) | Fastest path, OTA updates, Expo Router |
| Navigation | Expo Router (file-based) | Consistent with Next.js mental model |
| Dev builds | expo-dev-client (required) | react-native-pdf requires native code; Expo Go not supported |
| PDF processing | pdf-lib (direct) | Pure JS, works in RN Hermes runtime unchanged |
| PDF encryption | @pdfsmaller/pdf-encrypt | Uses SubtleCrypto — **must validate on Hermes before shipping Protect tool** (see Section 6) |
| PDF thumbnails | react-native-pdf-thumbnail | Wraps native PDFKit/PdfRenderer per platform |
| PDF→JPG output | react-native-pdf (native renderer) | Better quality than JS canvas alternatives; requires expo-dev-client |
| File I/O | expo-document-picker, expo-file-system, expo-camera | Standard Expo modules |
| Sharing/output | expo-sharing | Opens native Share sheet |
| Auth | @clerk/clerk-expo | Official Clerk RN SDK |
| Subscriptions | RevenueCat (react-native-purchases) | Handles IAP; Supabase webhook for entitlement sync |
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
  → 4×4 grid of all 16 tools (Word→PDF disabled/greyed)
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

## 5. All Tools (v1)

Ported from `lib/pdf-tools.ts`. Same logic, different I/O layer.

| Tool | Web function | Status | Notes |
|---|---|---|---|
| Compress | `compressPDF` | ✅ v1 | Same quality levels (low/med/high) |
| Split | `splitPDF` | ✅ v1 | Output: zip of individual pages via JSZip |
| Merge | `mergePDFs` | ✅ v1 | Multi-file select in picker |
| Rotate | `rotatePDF` | ✅ v1 | 90/180/270° |
| Watermark | `watermarkPDF` | ✅ v1 | Full options: text/position/opacity/size/color |
| Page Numbers | `addPageNumbers` | ✅ v1 | Bottom-left/center/right |
| Protect | `protectPDF` | ⚠️ v1 (pending validation) | AES-256 via @pdfsmaller/pdf-encrypt — Hermes SubtleCrypto must be confirmed |
| Unlock | `unlockPDF` | ✅ v1 | Password entry |
| Repair | `repairPDF` | ✅ v1 | pdf-lib reload + re-save |
| Crop | `cropPDF` | ✅ v1 | Margin sliders |
| Flatten | `flattenPDF` | ✅ v1 | Remove form fields |
| PDF→JPG | `pdfToJpg` | ✅ v1 | react-native-pdf native renderer; output as zip for multi-page |
| JPG→PDF | `jpgToPdf` | ✅ v1 | expo-image-picker → pdf-lib |
| Word→PDF | (web: server) | 🚫 v2 | No client-side path on mobile — shown as disabled in grid |
| Redact | `redactPDF` | ✅ v1 | Black rectangle overlay |
| Resize | `resizePDF` | ✅ v1 | Page size presets (A4, Letter, etc.) |

---

## 6. PDF Processing Layer

All processing runs in the React Native JS thread (Hermes). Running synchronous JS on the main thread freezes UI, so v1 enforces a **50 MB file size gate** — files above this are rejected with a user-facing error ("File too large for mobile processing — use the web app for large files"). Background thread offloading via `react-native-workers` is planned for v2.

**@pdfsmaller/pdf-encrypt + Hermes:** Hermes does not include `SubtleCrypto` by default. `expo-crypto` partially polyfills it in SDK 51+, but AES-256 GCM compatibility across both iOS and Android Hermes builds must be validated with a test build before the Protect tool ships. If validation fails, Protect is moved to v2 and a fallback (e.g., `react-native-crypto` via node-libs-expo) will be evaluated.

**Replacing web I/O:**

| Web API | Mobile replacement |
|---|---|
| `FileReader.readAsArrayBuffer` | `expo-file-system.readAsStringAsync` (base64) → decode to Uint8Array |
| `URL.createObjectURL` | Write bytes to `FileSystem.cacheDirectory` |
| `<a download>` click | `expo-sharing.shareAsync(localUri)` |
| Canvas API (JPG rendering) | `react-native-pdf` native renderer (requires expo-dev-client) |

**Output for multi-file results (Split, PDF→JPG):**
- Multiple output files → JSZip → single `.zip` → share/save

---

## 7. Authentication

- **Clerk React Native SDK** (`@clerk/clerk-expo`)
- Same Clerk instance as web — users share accounts
- Sign-in via email magic link or social (Google/Apple)
- `useUser()` hook available app-wide via ClerkProvider in `_layout.tsx`

---

## 8. Pro Tier Check

There are two Pro paths that must be reconciled. RevenueCat is the source of truth for IAP purchases. The web API is the fallback for users who subscribed on the web before the mobile app existed.

**Priority order in `lib/useProStatus.ts`:**

```
1. Check AsyncStorage for bulk day pass (`rizzpdf_bulk_until` timestamp)
   → if valid: isPro = true, done

2. Check RevenueCat entitlement cache (local, no network)
   → if "pro" entitlement active: isPro = true, done

3. If Clerk user is signed in, fetch `https://rizzpdf.com/api/user/subscription`
   with Clerk session token as Authorization header
   → if tier === "pro": isPro = true, done
   → on network error: fail open, isPro = false (do not block usage)

4. Default: free tier
```

RevenueCat is checked before the web API to minimize network calls. The web API call only fires for signed-in users who have no RevenueCat entitlement — typically web-only subscribers in v1.

**v2:** Full bidirectional Stripe ↔ RevenueCat webhook sync will eliminate the web API fallback call entirely.

---

## 9. Monetization

**Three tiers (same as web):**

| Tier | Price | Access |
|---|---|---|
| Free | $0 | 3 operations (persistent across sessions, same as web) |
| Bulk | $1 / 24hr | Unlimited for 24 hours, no account needed |
| Pro | $7/mo | Unlimited |

**Implementation:**
- **RevenueCat** (`react-native-purchases`) manages iOS App Store + Google Play IAP
- RevenueCat webhook → Supabase `subscriptions` table (same table web uses)
- Bulk day pass: stored in AsyncStorage (`rizzpdf_bulk_until` timestamp, same semantics as web localStorage)

**Paywall trigger:** After 3rd free operation, `PaywallSheet` bottom sheet appears with two options: Bulk ($1) and Pro ($7/mo).

---

## 10. Free Tier Tracking

- AsyncStorage key: `rizzpdf_free_count` — persistent integer (not reset on app restart, matching web behavior)
- AsyncStorage key: `rizzpdf_bulk_until` — timestamp ms
- Pro entitlement: RevenueCat local cache, refreshed on app foreground

---

## 11. Error Handling

- Processing errors: shown inline on Result sheet with plain-English message
- File too large (>50 MB): rejected before processing with clear message
- Auth errors: silent fail → user stays on free tier
- File I/O errors: toast notification via `react-native-toast-message`
- Network errors (subscription check): fail open → treat as free tier (don't block usage)

---

## 12. Pre-Submission Checklist

Before App Store / Play Store submission:

- [ ] **AES-256 export compliance (iOS):** Set `ITSAppUsesNonExemptEncryption = YES` in `Info.plist` and complete the annual encryption self-classification report in App Store Connect. This is a concrete required step, not optional.
- [ ] **Hermes SubtleCrypto validation:** Confirm `@pdfsmaller/pdf-encrypt` works on both iOS and Android Hermes builds in a development build (not Expo Go)
- [ ] **50 MB gate tested** on both platforms with a large PDF
- [ ] **RevenueCat sandbox** purchases tested on both iOS (TestFlight) and Android (internal track)

---

## 13. Out of Scope (v1)

- Word→PDF conversion
- Background thread processing for large files (react-native-workers)
- Full Stripe ↔ RevenueCat bidirectional webhook sync
- iPad-specific layout optimizations
- Push notifications
- File sync / cloud backup of processed files
- Offline subscription verification
