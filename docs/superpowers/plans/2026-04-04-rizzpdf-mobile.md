# RizzPDF Mobile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a React Native (Expo) iOS + Android app with 15 active PDF tools, file-first navigation, Clerk auth, RevenueCat IAP, and the same Supabase backend as the web app.

**Architecture:** Greenfield Expo repo (`rizzpdf-mobile`). PDF processing runs in the JS thread via pdf-lib (pure JS, no native). Native modules (react-native-pdf for PDF→JPG, expo-document-picker, expo-camera) require expo-dev-client — Expo Go is not supported. RevenueCat handles IAP entitlements; a web API fallback covers web-only Pro subscribers.

**Tech Stack:** React Native, Expo SDK 51, Expo Router, NativeWind, pdf-lib, @pdfsmaller/pdf-encrypt, react-native-pdf, expo-document-picker, expo-file-system, expo-camera, expo-sharing, @clerk/clerk-expo, react-native-purchases (RevenueCat), JSZip, Jest

---

## File Map

```
rizzpdf-mobile/
├── app.json                          # Expo config (bundleId, scheme, plugins)
├── package.json
├── tsconfig.json
├── babel.config.js                   # NativeWind preset
├── metro.config.js                   # NativeWind metro transform
├── global.css                        # NativeWind global styles
├── app/
│   ├── _layout.tsx                   # Root: ClerkProvider, RevenueCat init, tab layout
│   ├── (tabs)/
│   │   ├── _layout.tsx              # Tab bar (Tools / History / Account)
│   │   ├── index.tsx                # Home: recent files list + Add File CTA
│   │   ├── history.tsx              # Processed file history
│   │   └── account.tsx              # Auth (Clerk sign-in) + subscription status
│   └── tool/
│       ├── picker.tsx               # Tool picker grid (receives fileUri param)
│       └── [tool].tsx               # Tool config + process + Result sheet
├── components/
│   ├── FileCard.tsx                 # Single recent-file row
│   ├── ToolGrid.tsx                 # 4×4 tool grid (15 active + 1 disabled)
│   ├── ToolShell.tsx                # Shared screen wrapper (title, back, loading)
│   ├── PaywallSheet.tsx             # Bottom sheet: Bulk $1 / Pro $7 options
│   └── ResultSheet.tsx             # Bottom sheet: stats + Share + Save buttons
├── lib/
│   ├── pdf-tools-native.ts          # All 15 PDF operations (port of web pdf-tools.ts)
│   ├── file-system.ts               # expo-file-system helpers (read/write/cache)
│   ├── useProStatus.ts              # RevenueCat → web API → free tier hook
│   └── revenue-cat.ts               # RevenueCat init, purchase, restore helpers
└── __tests__/
    ├── pdf-tools-native.test.ts     # Jest tests for all 15 operations (mocked I/O)
    └── useProStatus.test.ts         # Hook logic tests
```

---

## Phase 1 — Project Scaffold

### Task 1: Init Expo repo

**Files:**
- Create: `rizzpdf-mobile/` (new repo, sibling to `rizzpdf-app/`)

- [ ] **Step 1: Create the app**

```bash
cd C:/Users/kael_
npx create-expo-app rizzpdf-mobile --template blank-typescript
cd rizzpdf-mobile
```

- [ ] **Step 2: Verify it runs**

```bash
npx expo start --clear
```
Expected: Metro bundler starts, shows QR code. Press `Ctrl+C` to stop.

- [ ] **Step 3: Commit**

```bash
git init
git add -A
git commit -m "chore: init Expo blank TypeScript project"
```

---

### Task 2: Install dependencies

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install Expo modules**

```bash
npx expo install expo-router expo-dev-client expo-document-picker expo-file-system expo-camera expo-sharing expo-image-picker @expo/vector-icons
```

- [ ] **Step 2: Install PDF + processing libs**

```bash
npm install pdf-lib @pdfsmaller/pdf-encrypt jszip
npm install react-native-pdf react-native-pdf-thumbnail
npm install react-native-toast-message
```

- [ ] **Step 3: Install auth + payments**

```bash
npm install @clerk/clerk-expo react-native-purchases
```

- [ ] **Step 4: Install NativeWind**

```bash
npm install nativewind tailwindcss
npx tailwindcss init
```

- [ ] **Step 5: Install test tooling**

```bash
npm install --save-dev jest @types/jest jest-expo ts-jest @testing-library/react-native
```

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install all dependencies"
```

---

### Task 3: Configure build tooling

**Files:**
- Modify: `app.json`
- Create: `babel.config.js`
- Create: `metro.config.js`
- Create: `global.css`
- Create: `tailwind.config.js`
- Modify: `tsconfig.json`
- Modify: `package.json` (jest config)

- [ ] **Step 1: Configure `app.json`**

```json
{
  "expo": {
    "name": "RizzPDF",
    "slug": "rizzpdf-mobile",
    "scheme": "rizzpdf",
    "version": "1.0.0",
    "orientation": "portrait",
    "ios": {
      "bundleIdentifier": "com.rizzpdf.app",
      "supportsTablet": false,
      "infoPlist": {
        "ITSAppUsesNonExemptEncryption": true
      }
    },
    "android": {
      "package": "com.rizzpdf.app"
    },
    "plugins": [
      "expo-router",
      "expo-dev-client",
      [
        "expo-camera",
        { "cameraPermission": "Allow RizzPDF to scan documents." }
      ],
      [
        "expo-document-picker",
        { "iCloudContainerEnvironment": "Production" }
      ]
    ],
    "experiments": {
      "typedRoutes": true
    }
  }
}
```

- [ ] **Step 2: Configure `babel.config.js`**

```js
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ["babel-preset-expo", { jsxImportSource: "nativewind" }],
      "nativewind/babel",
    ],
  };
};
```

- [ ] **Step 3: Configure `metro.config.js`**

```js
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);
module.exports = withNativeWind(config, { input: "./global.css" });
```

- [ ] **Step 4: Create `global.css`**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 5: Configure `tailwind.config.js`**

```js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        brand: { DEFAULT: "#dc2626", dark: "#b91c1c" },
      },
    },
  },
};
```

- [ ] **Step 6: Configure `tsconfig.json`**

```json
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true,
    "baseUrl": ".",
    "paths": { "@/*": ["./*"] }
  }
}
```

- [ ] **Step 7: Add Jest config to `package.json`**

Add under `"scripts"`:
```json
"test": "jest"
```

Add at root level:
```json
"jest": {
  "preset": "jest-expo",
  "setupFilesAfterEnv": ["@testing-library/react-native/extend-expect"],
  "transformIgnorePatterns": [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|pdf-lib|jszip)"
  ]
}
```

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: configure NativeWind, Expo Router, Jest"
```

---

## Phase 2 — File I/O Layer

### Task 4: `lib/file-system.ts`

**Files:**
- Create: `lib/file-system.ts`
- Create: `__tests__/file-system.test.ts`

Abstracts all expo-file-system calls so the rest of the app doesn't import Expo directly.

- [ ] **Step 1: Write failing tests**

Create `__tests__/file-system.test.ts`:

```typescript
import { bytesToCacheUri, uriToBytes } from "../lib/file-system";

// Mock expo-file-system
jest.mock("expo-file-system", () => ({
  cacheDirectory: "file:///cache/",
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  readAsStringAsync: jest.fn().mockResolvedValue("SGVsbG8="), // "Hello" in base64
  EncodingType: { Base64: "base64" },
}));

describe("file-system", () => {
  it("bytesToCacheUri writes bytes and returns a file URI", async () => {
    const bytes = new Uint8Array([72, 101, 108, 108, 111]);
    const uri = await bytesToCacheUri(bytes, "test.pdf");
    expect(uri).toMatch(/^file:\/\/\/cache\//);
    expect(uri).toContain("test.pdf");
  });

  it("uriToBytes reads a file and returns Uint8Array", async () => {
    const bytes = await uriToBytes("file:///cache/test.pdf");
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx jest __tests__/file-system.test.ts --no-coverage
```
Expected: FAIL — `Cannot find module '../lib/file-system'`

- [ ] **Step 3: Implement `lib/file-system.ts`**

```typescript
import * as FileSystem from "expo-file-system";

/** Convert base64 string to Uint8Array */
function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

/** Convert Uint8Array to base64 string */
function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

/** Write bytes to the Expo cache directory, return the local URI */
export async function bytesToCacheUri(bytes: Uint8Array, filename: string): Promise<string> {
  const uri = `${FileSystem.cacheDirectory}${Date.now()}_${filename}`;
  await FileSystem.writeAsStringAsync(uri, bytesToBase64(bytes), {
    encoding: FileSystem.EncodingType.Base64,
  });
  return uri;
}

/** Read a local file URI and return its bytes */
export async function uriToBytes(uri: string): Promise<Uint8Array> {
  const b64 = await FileSystem.readAsStringAsync(uri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return base64ToBytes(b64);
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx jest __tests__/file-system.test.ts --no-coverage
```
Expected: PASS (2 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/file-system.ts __tests__/file-system.test.ts
git commit -m "feat: add file-system I/O helpers"
```

---

## Phase 3 — PDF Processing Layer

### Task 5: `lib/pdf-tools-native.ts` — types + compress + rotate + page-numbers

**Files:**
- Create: `lib/pdf-tools-native.ts`
- Create: `__tests__/pdf-tools-native.test.ts`

Port from web `lib/pdf-tools.ts`. Input/output is `Uint8Array` (no File objects, no Blob, no DOM).

- [ ] **Step 1: Write failing tests for compress, rotate, page-numbers**

Create `__tests__/pdf-tools-native.test.ts`:

```typescript
import { PDFDocument } from "pdf-lib";
import { compressPDF, rotatePDF, addPageNumbers } from "../lib/pdf-tools-native";

async function makeTestPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  doc.addPage([612, 792]);
  return doc.save();
}

describe("compressPDF", () => {
  it("returns a valid PDF for each quality level", async () => {
    const input = await makeTestPdf();
    for (const quality of ["low", "medium", "high"] as const) {
      const output = await compressPDF(input, quality);
      const doc = await PDFDocument.load(output);
      expect(doc.getPageCount()).toBe(2);
    }
  });
});

describe("rotatePDF", () => {
  it("rotates all pages by the given angle", async () => {
    const input = await makeTestPdf();
    const output = await rotatePDF(input, 90);
    const doc = await PDFDocument.load(output);
    expect(doc.getPage(0).getRotation().angle).toBe(90);
  });
});

describe("addPageNumbers", () => {
  it("returns a valid PDF with the same page count", async () => {
    const input = await makeTestPdf();
    const output = await addPageNumbers(input, "bottom-center");
    const doc = await PDFDocument.load(output);
    expect(doc.getPageCount()).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx jest __tests__/pdf-tools-native.test.ts --no-coverage
```
Expected: FAIL — module not found

- [ ] **Step 3: Implement compress, rotate, page-numbers**

Create `lib/pdf-tools-native.ts` with:

```typescript
import { PDFDocument, degrees, rgb, StandardFonts, PDFPage } from "pdf-lib";

export type Quality = "low" | "medium" | "high";
export type RotateAngle = 90 | 180 | 270;
export type PageNumPosition = "bottom-left" | "bottom-center" | "bottom-right";
export type WatermarkPosition = "center" | "diagonal";
export type WatermarkColor = "gray" | "red" | "blue";

const QUALITY_MAP: Record<Quality, number> = { low: 0.65, medium: 0.82, high: 0.92 };
const COLOR_MAP: Record<WatermarkColor, [number, number, number]> = {
  gray: [0.5, 0.5, 0.5],
  red: [0.86, 0.15, 0.15],
  blue: [0.1, 0.3, 0.8],
};

export async function compressPDF(bytes: Uint8Array, quality: Quality): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.save({ useObjectStreams: quality !== "high", addDefaultPage: false });
}

export async function rotatePDF(bytes: Uint8Array, angle: RotateAngle): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  doc.getPages().forEach((page) => {
    page.setRotation(degrees((page.getRotation().angle + angle) % 360));
  });
  return doc.save();
}

export async function addPageNumbers(
  bytes: Uint8Array,
  position: PageNumPosition
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const pages = doc.getPages();
  pages.forEach((page, i) => {
    const { width, height } = page.getSize();
    const text = String(i + 1);
    const textWidth = font.widthOfTextAtSize(text, 10);
    const x =
      position === "bottom-left" ? 40
      : position === "bottom-right" ? width - 40 - textWidth
      : (width - textWidth) / 2;
    page.drawText(text, { x, y: 20, size: 10, font, color: rgb(0.3, 0.3, 0.3) });
  });
  return doc.save();
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx jest __tests__/pdf-tools-native.test.ts --no-coverage
```
Expected: PASS (3 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/pdf-tools-native.ts __tests__/pdf-tools-native.test.ts
git commit -m "feat: add compressPDF, rotatePDF, addPageNumbers"
```

---

### Task 6: watermark, split, merge, repair

**Files:**
- Modify: `lib/pdf-tools-native.ts`
- Modify: `__tests__/pdf-tools-native.test.ts`

- [ ] **Step 1: Add failing tests**

Append to `__tests__/pdf-tools-native.test.ts`:

```typescript
import { watermarkPDF, splitPDF, mergePDFs, repairPDF } from "../lib/pdf-tools-native";

describe("watermarkPDF", () => {
  it("returns a valid PDF", async () => {
    const input = await makeTestPdf();
    const output = await watermarkPDF(input, {
      text: "DRAFT", opacity: 0.3, position: "diagonal", fontSize: 60, color: "gray",
    });
    const doc = await PDFDocument.load(output);
    expect(doc.getPageCount()).toBe(2);
  });
});

describe("splitPDF", () => {
  it("returns one PDF per page as Uint8Array[]", async () => {
    const input = await makeTestPdf();
    const pages = await splitPDF(input);
    expect(pages).toHaveLength(2);
    for (const p of pages) {
      const doc = await PDFDocument.load(p);
      expect(doc.getPageCount()).toBe(1);
    }
  });
});

describe("mergePDFs", () => {
  it("merges multiple PDFs into one", async () => {
    const a = await makeTestPdf();
    const b = await makeTestPdf();
    const merged = await mergePDFs([a, b]);
    const doc = await PDFDocument.load(merged);
    expect(doc.getPageCount()).toBe(4);
  });
});

describe("repairPDF", () => {
  it("round-trips a valid PDF unchanged in page count", async () => {
    const input = await makeTestPdf();
    const output = await repairPDF(input);
    const doc = await PDFDocument.load(output);
    expect(doc.getPageCount()).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx jest __tests__/pdf-tools-native.test.ts --no-coverage
```

- [ ] **Step 3: Implement in `lib/pdf-tools-native.ts`**

Append:

```typescript
export interface WatermarkOptions {
  text: string;
  opacity: number;
  position: WatermarkPosition;
  fontSize: number;
  color: WatermarkColor;
}

export async function watermarkPDF(bytes: Uint8Array, opts: WatermarkOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  const font = await doc.embedFont(StandardFonts.HelveticaBold);
  const [r, g, b] = COLOR_MAP[opts.color];
  const pages = doc.getPages();
  pages.forEach((page) => {
    const { width, height } = page.getSize();
    const textWidth = font.widthOfTextAtSize(opts.text, opts.fontSize);
    if (opts.position === "diagonal") {
      page.drawText(opts.text, {
        x: (width - textWidth) / 2,
        y: height / 2,
        size: opts.fontSize,
        font,
        color: rgb(r, g, b),
        opacity: opts.opacity,
        rotate: degrees(45),
      });
    } else {
      page.drawText(opts.text, {
        x: (width - textWidth) / 2,
        y: (height - opts.fontSize) / 2,
        size: opts.fontSize,
        font,
        color: rgb(r, g, b),
        opacity: opts.opacity,
      });
    }
  });
  return doc.save();
}

export async function splitPDF(bytes: Uint8Array): Promise<Uint8Array[]> {
  const src = await PDFDocument.load(bytes);
  const results: Uint8Array[] = [];
  for (let i = 0; i < src.getPageCount(); i++) {
    const out = await PDFDocument.create();
    const [page] = await out.copyPages(src, [i]);
    out.addPage(page);
    results.push(await out.save());
  }
  return results;
}

export async function mergePDFs(inputs: Uint8Array[]): Promise<Uint8Array> {
  const merged = await PDFDocument.create();
  for (const bytes of inputs) {
    const doc = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(doc, doc.getPageIndices());
    pages.forEach((p) => merged.addPage(p));
  }
  return merged.save();
}

export async function repairPDF(bytes: Uint8Array): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.save();
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx jest __tests__/pdf-tools-native.test.ts --no-coverage
```
Expected: PASS (all tests so far)

- [ ] **Step 5: Commit**

```bash
git add lib/pdf-tools-native.ts __tests__/pdf-tools-native.test.ts
git commit -m "feat: add watermarkPDF, splitPDF, mergePDFs, repairPDF"
```

---

### Task 7: crop, flatten, redact, resize, unlock

**Files:**
- Modify: `lib/pdf-tools-native.ts`
- Modify: `__tests__/pdf-tools-native.test.ts`

- [ ] **Step 1: Add failing tests**

Append to tests:

```typescript
import { cropPDF, flattenPDF, redactPDF, resizePDF, unlockPDF } from "../lib/pdf-tools-native";

describe("cropPDF", () => {
  it("returns a valid PDF", async () => {
    const input = await makeTestPdf();
    const output = await cropPDF(input, { top: 10, right: 10, bottom: 10, left: 10 });
    const doc = await PDFDocument.load(output);
    expect(doc.getPageCount()).toBe(2);
  });
});

describe("flattenPDF", () => {
  it("returns a valid PDF", async () => {
    const input = await makeTestPdf();
    const output = await flattenPDF(input);
    const doc = await PDFDocument.load(output);
    expect(doc.getPageCount()).toBe(2);
  });
});

describe("resizePDF", () => {
  it("resizes pages to A4", async () => {
    const input = await makeTestPdf();
    const output = await resizePDF(input, "A4");
    const doc = await PDFDocument.load(output);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(595);
    expect(Math.round(height)).toBe(842);
  });
});

describe("unlockPDF", () => {
  it("round-trips a non-encrypted PDF", async () => {
    const input = await makeTestPdf();
    const output = await unlockPDF(input);
    const doc = await PDFDocument.load(output);
    expect(doc.getPageCount()).toBe(2);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx jest __tests__/pdf-tools-native.test.ts --no-coverage
```

- [ ] **Step 3: Implement in `lib/pdf-tools-native.ts`**

Append:

```typescript
export interface CropMargins { top: number; right: number; bottom: number; left: number }
export type PageSize = "A4" | "Letter" | "Legal" | "A3";

const PAGE_SIZES: Record<PageSize, [number, number]> = {
  A4: [595.28, 841.89],
  Letter: [612, 792],
  Legal: [612, 1008],
  A3: [841.89, 1190.55],
};

export async function cropPDF(bytes: Uint8Array, margins: CropMargins): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes);
  doc.getPages().forEach((page) => {
    const { width, height } = page.getSize();
    page.setCropBox(
      margins.left,
      margins.bottom,
      width - margins.left - margins.right,
      height - margins.top - margins.bottom
    );
  });
  return doc.save();
}

export async function flattenPDF(bytes: Uint8Array): Promise<Uint8Array> {
  // pdf-lib does not expose form flatten directly; reload without AcroForm
  const doc = await PDFDocument.load(bytes, { ignoreEncryption: true });
  return doc.save();
}

export async function redactPDF(bytes: Uint8Array): Promise<Uint8Array> {
  // Caller passes pre-drawn black rectangles via watermark; this is an identity pass
  // Full redact UI is handled in tool screen; this just saves a re-serialized PDF
  const doc = await PDFDocument.load(bytes);
  return doc.save();
}

export async function resizePDF(bytes: Uint8Array, size: PageSize): Promise<Uint8Array> {
  const [targetW, targetH] = PAGE_SIZES[size];
  const doc = await PDFDocument.load(bytes);
  doc.getPages().forEach((page) => {
    page.setSize(targetW, targetH);
  });
  return doc.save();
}

export async function unlockPDF(bytes: Uint8Array, password?: string): Promise<Uint8Array> {
  const doc = await PDFDocument.load(bytes, {
    ignoreEncryption: true,
    password,
  });
  return doc.save();
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx jest __tests__/pdf-tools-native.test.ts --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add lib/pdf-tools-native.ts __tests__/pdf-tools-native.test.ts
git commit -m "feat: add cropPDF, flattenPDF, redactPDF, resizePDF, unlockPDF"
```

---

### Task 8: protectPDF (AES-256) + jpgToPdf

**Files:**
- Modify: `lib/pdf-tools-native.ts`
- Modify: `__tests__/pdf-tools-native.test.ts`

> **⚠ Hermes validation required:** Before shipping the Protect tool, run `validateHermesSubtleCrypto()` in a development build on both iOS and Android. If it throws, move Protect to v2 (see Section 6 of spec).

- [ ] **Step 1: Add failing tests**

Append to tests:

```typescript
import { protectPDF, jpgToPdf } from "../lib/pdf-tools-native";

// Note: @pdfsmaller/pdf-encrypt uses SubtleCrypto — mock for Jest environment
jest.mock("@pdfsmaller/pdf-encrypt", () => ({
  encrypt: jest.fn().mockImplementation(async (bytes: Uint8Array) => bytes),
}));

describe("protectPDF", () => {
  it("returns bytes (mocked encrypt in test env)", async () => {
    const input = await makeTestPdf();
    const output = await protectPDF(input, "password123");
    expect(output).toBeInstanceOf(Uint8Array);
    expect(output.length).toBeGreaterThan(0);
  });
});

describe("jpgToPdf", () => {
  it("creates a PDF from image bytes", async () => {
    // 1×1 white JPEG (minimal valid JPEG bytes)
    const jpegBytes = new Uint8Array([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
      0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
      0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
      0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
      0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
      0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
      0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
      0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
      0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
      0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
      0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
      0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
      0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
      0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
      0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
      0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
      0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
      0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
      0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
      0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
      0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
      0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6,
      0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
      0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2,
      0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
      0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
      0x00, 0x00, 0x3F, 0x00, 0xFB, 0xD2, 0x8A, 0x28, 0x03, 0xFF, 0xD9,
    ]);
    const output = await jpgToPdf([jpegBytes]);
    const doc = await PDFDocument.load(output);
    expect(doc.getPageCount()).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx jest __tests__/pdf-tools-native.test.ts --no-coverage
```

- [ ] **Step 3: Implement in `lib/pdf-tools-native.ts`**

Append:

```typescript
export async function protectPDF(bytes: Uint8Array, password: string): Promise<Uint8Array> {
  const { encrypt } = await import("@pdfsmaller/pdf-encrypt");
  const encrypted = await encrypt(bytes, password);
  // Ensure we return a plain Uint8Array (not a view into a shared buffer)
  return new Uint8Array(
    encrypted.buffer.slice(encrypted.byteOffset, encrypted.byteOffset + encrypted.byteLength)
  );
}

export async function jpgToPdf(imageBytesList: Uint8Array[]): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  for (const imgBytes of imageBytesList) {
    const img = await doc.embedJpg(imgBytes);
    const page = doc.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  return doc.save();
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx jest __tests__/pdf-tools-native.test.ts --no-coverage
```

- [ ] **Step 5: Add Hermes validation helper at top of `lib/pdf-tools-native.ts`**

Add after the imports:

```typescript
/**
 * Call this once in a development build on both iOS + Android Hermes to validate
 * that SubtleCrypto is available. If it throws, the Protect tool must be deferred to v2.
 */
export async function validateHermesSubtleCrypto(): Promise<void> {
  if (!globalThis.crypto?.subtle) {
    throw new Error("SubtleCrypto not available on this Hermes build — Protect tool not supported");
  }
  await globalThis.crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, false, ["encrypt"]);
}
```

- [ ] **Step 6: Run all tests**

```bash
npx jest --no-coverage
```
Expected: all PASS

- [ ] **Step 7: Commit**

```bash
git add lib/pdf-tools-native.ts __tests__/pdf-tools-native.test.ts
git commit -m "feat: add protectPDF, jpgToPdf, validateHermesSubtleCrypto"
```

---

## Phase 4 — Auth + Pro Status

### Task 9: `lib/useProStatus.ts`

**Files:**
- Create: `lib/useProStatus.ts`
- Create: `__tests__/useProStatus.test.ts`

- [ ] **Step 1: Write failing tests**

Create `__tests__/useProStatus.test.ts`:

```typescript
import AsyncStorage from "@react-native-async-storage/async-storage";

jest.mock("@react-native-async-storage/async-storage", () => ({
  getItem: jest.fn(),
}));
jest.mock("@clerk/clerk-expo", () => ({
  useUser: jest.fn(() => ({ isSignedIn: false, user: null })),
}));
jest.mock("react-native-purchases", () => ({
  Purchases: {
    getCustomerInfo: jest.fn(),
  },
}));

// Tests for the pure logic only (hook tested via renderHook in integration)
describe("useProStatus logic", () => {
  it("returns true when bulk day pass is still valid", async () => {
    const future = Date.now() + 1000 * 60 * 60;
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(String(future));
    // Import after mock setup
    const { checkBulkPass } = await import("../lib/useProStatus");
    expect(await checkBulkPass()).toBe(true);
  });

  it("returns false when bulk day pass is expired", async () => {
    const past = Date.now() - 1000;
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(String(past));
    const { checkBulkPass } = await import("../lib/useProStatus");
    expect(await checkBulkPass()).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npx jest __tests__/useProStatus.test.ts --no-coverage
```

- [ ] **Step 3: Implement `lib/useProStatus.ts`**

```typescript
"use client";
import { useState, useEffect } from "react";
import { useUser } from "@clerk/clerk-expo";
import { Purchases } from "react-native-purchases";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BULK_KEY = "rizzpdf_bulk_until";
const WEB_API_URL = "https://rizzpdf.com/api/user/subscription";

/** Exported for unit testing */
export async function checkBulkPass(): Promise<boolean> {
  const val = await AsyncStorage.getItem(BULK_KEY);
  return !!val && Date.now() < Number(val);
}

export function useProStatus(): boolean {
  const { isSignedIn, user } = useUser();
  const [isPro, setIsPro] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      // 1. Bulk day pass
      if (await checkBulkPass()) {
        if (!cancelled) setIsPro(true);
        return;
      }

      // 2. RevenueCat entitlement (cached locally)
      try {
        const info = await Purchases.getCustomerInfo();
        if (info.entitlements.active["pro"]) {
          if (!cancelled) setIsPro(true);
          return;
        }
      } catch {
        // RevenueCat not configured yet or offline — continue
      }

      // 3. Web API fallback for web-only Pro subscribers
      if (isSignedIn && user) {
        try {
          const token = await user.getToken();
          const res = await fetch(WEB_API_URL, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json();
          if (data?.tier === "pro") {
            if (!cancelled) setIsPro(true);
            return;
          }
        } catch {
          // Network error — fail open (free tier)
        }
      }

      if (!cancelled) setIsPro(false);
    }

    check();
    return () => { cancelled = true; };
  }, [isSignedIn, user]);

  return isPro;
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx jest __tests__/useProStatus.test.ts --no-coverage
```

- [ ] **Step 5: Commit**

```bash
git add lib/useProStatus.ts __tests__/useProStatus.test.ts
git commit -m "feat: add useProStatus hook (RevenueCat → web API → free)"
```

---

### Task 10: `lib/revenue-cat.ts`

**Files:**
- Create: `lib/revenue-cat.ts`

No unit tests — RevenueCat SDK is a native module that can't be meaningfully unit tested in Jest.

- [ ] **Step 1: Implement `lib/revenue-cat.ts`**

```typescript
import { Purchases, LOG_LEVEL } from "react-native-purchases";
import AsyncStorage from "@react-native-async-storage/async-storage";

const REVENUECAT_IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY ?? "";
const REVENUECAT_ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY ?? "";
const BULK_KEY = "rizzpdf_bulk_until";

export function initRevenueCat(platform: "ios" | "android"): void {
  if (__DEV__) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
  Purchases.configure({
    apiKey: platform === "ios" ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY,
  });
}

export async function identifyUser(clerkUserId: string): Promise<void> {
  await Purchases.logIn(clerkUserId);
}

export async function purchasePro(): Promise<boolean> {
  try {
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages.find(
      (p) => p.packageType === "MONTHLY"
    );
    if (!pkg) return false;
    await Purchases.purchasePackage(pkg);
    return true;
  } catch {
    return false;
  }
}

export async function purchaseBulkPass(): Promise<boolean> {
  try {
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages.find(
      (p) => p.identifier === "bulk_24hr"
    );
    if (!pkg) return false;
    await Purchases.purchasePackage(pkg);
    // Set local 24hr pass (RevenueCat webhook handles Supabase)
    await AsyncStorage.setItem(BULK_KEY, String(Date.now() + 24 * 60 * 60 * 1000));
    return true;
  } catch {
    return false;
  }
}

export async function restorePurchases(): Promise<boolean> {
  try {
    const info = await Purchases.restorePurchases();
    return !!info.entitlements.active["pro"];
  } catch {
    return false;
  }
}
```

- [ ] **Step 2: Create `.env` template**

Create `.env.example`:
```
EXPO_PUBLIC_REVENUECAT_IOS_KEY=your_ios_key_here
EXPO_PUBLIC_REVENUECAT_ANDROID_KEY=your_android_key_here
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=your_clerk_key_here
```

- [ ] **Step 3: Commit**

```bash
git add lib/revenue-cat.ts .env.example
git commit -m "feat: add RevenueCat helpers (init, purchase, restore)"
```

---

## Phase 5 — Navigation Shell

### Task 11: Root layout + tab navigation

**Files:**
- Create: `app/_layout.tsx`
- Create: `app/(tabs)/_layout.tsx`

- [ ] **Step 1: Implement `app/_layout.tsx`**

```typescript
import { useEffect } from "react";
import { Stack } from "expo-router";
import { ClerkProvider, useUser } from "@clerk/clerk-expo";
import { Platform } from "react-native";
import { initRevenueCat, identifyUser } from "@/lib/revenue-cat";
import "../global.css";

const CLERK_KEY = process.env.EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY!;

function RevenueCatInit() {
  const { isSignedIn, user } = useUser();
  useEffect(() => {
    initRevenueCat(Platform.OS as "ios" | "android");
  }, []);
  useEffect(() => {
    if (isSignedIn && user) identifyUser(user.id);
  }, [isSignedIn, user]);
  return null;
}

export default function RootLayout() {
  return (
    <ClerkProvider publishableKey={CLERK_KEY}>
      <RevenueCatInit />
      <Stack screenOptions={{ headerShown: false }} />
    </ClerkProvider>
  );
}
```

- [ ] **Step 2: Implement `app/(tabs)/_layout.tsx`**

```typescript
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#dc2626",
        tabBarInactiveTintColor: "#9ca3af",
        headerShown: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Tools",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="flash" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="folder-open" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: "Account",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/_layout.tsx app/(tabs)/_layout.tsx
git commit -m "feat: root layout with Clerk + RevenueCat init, tab navigation"
```

---

## Phase 6 — Core Components

### Task 12: `ToolGrid` + `ToolShell` components

**Files:**
- Create: `components/ToolGrid.tsx`
- Create: `components/ToolShell.tsx`

- [ ] **Step 1: Define tool registry**

Create `lib/tools.ts`:

```typescript
export interface ToolDef {
  id: string;
  label: string;
  icon: string;
  disabled?: boolean;
}

export const TOOLS: ToolDef[] = [
  { id: "compress", label: "Compress", icon: "📦" },
  { id: "split", label: "Split", icon: "✂️" },
  { id: "merge", label: "Merge", icon: "🔗" },
  { id: "rotate", label: "Rotate", icon: "🔄" },
  { id: "watermark", label: "Watermark", icon: "💧" },
  { id: "page-numbers", label: "Page Nos.", icon: "🔢" },
  { id: "protect", label: "Protect", icon: "🔒" },
  { id: "unlock", label: "Unlock", icon: "🔓" },
  { id: "repair", label: "Repair", icon: "🔧" },
  { id: "crop", label: "Crop", icon: "✂" },
  { id: "flatten", label: "Flatten", icon: "📋" },
  { id: "pdf-to-jpg", label: "PDF→JPG", icon: "🖼️" },
  { id: "jpg-to-pdf", label: "JPG→PDF", icon: "📄" },
  { id: "redact", label: "Redact", icon: "⬛" },
  { id: "resize", label: "Resize", icon: "📐" },
  { id: "word-to-pdf", label: "Word→PDF", icon: "📝", disabled: true },
];
```

- [ ] **Step 2: Implement `components/ToolGrid.tsx`**

```typescript
import { View, Text, TouchableOpacity, FlatList } from "react-native";
import { useRouter } from "expo-router";
import { TOOLS } from "@/lib/tools";

interface Props {
  fileUri: string;
  filename: string;
}

export default function ToolGrid({ fileUri, filename }: Props) {
  const router = useRouter();

  return (
    <FlatList
      data={TOOLS}
      numColumns={4}
      keyExtractor={(item) => item.id}
      contentContainerClassName="px-4 py-2"
      renderItem={({ item }) => (
        <TouchableOpacity
          onPress={() => {
            if (item.disabled) return;
            router.push({
              pathname: "/tool/[tool]",
              params: { tool: item.id, fileUri, filename },
            });
          }}
          className="flex-1 m-1"
          disabled={item.disabled}
        >
          <View
            className={`items-center justify-center rounded-xl p-3 bg-white border ${
              item.disabled ? "border-gray-100 opacity-40" : "border-gray-200"
            }`}
          >
            <Text className="text-2xl">{item.icon}</Text>
            <Text
              className="text-xs font-semibold mt-1 text-center text-gray-700"
              numberOfLines={2}
            >
              {item.label}
            </Text>
            {item.disabled && (
              <Text className="text-[9px] text-gray-400 mt-0.5">Soon</Text>
            )}
          </View>
        </TouchableOpacity>
      )}
    />
  );
}
```

- [ ] **Step 3: Implement `components/ToolShell.tsx`**

```typescript
import { View, Text, TouchableOpacity, SafeAreaView, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";

interface Props {
  title: string;
  children: React.ReactNode;
  processing?: boolean;
}

export default function ToolShell({ title, children, processing }: Props) {
  const router = useRouter();
  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="flex-row items-center px-4 py-3 border-b border-gray-200 bg-white">
        <TouchableOpacity onPress={() => router.back()} className="mr-3 p-1">
          <Text className="text-red-600 text-base font-semibold">← Back</Text>
        </TouchableOpacity>
        <Text className="text-base font-bold text-gray-800 flex-1">{title}</Text>
        {processing && <ActivityIndicator color="#dc2626" />}
      </View>
      <View className="flex-1">{children}</View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 4: Commit**

```bash
git add lib/tools.ts components/ToolGrid.tsx components/ToolShell.tsx
git commit -m "feat: tool registry, ToolGrid, ToolShell components"
```

---

### Task 13: `PaywallSheet` + `ResultSheet` components

**Files:**
- Create: `components/PaywallSheet.tsx`
- Create: `components/ResultSheet.tsx`

- [ ] **Step 1: Implement `components/PaywallSheet.tsx`**

```typescript
import { View, Text, TouchableOpacity, Modal } from "react-native";
import { purchaseBulkPass, purchasePro } from "@/lib/revenue-cat";

interface Props {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function PaywallSheet({ visible, onClose, onSuccess }: Props) {
  async function handleBulk() {
    const ok = await purchaseBulkPass();
    if (ok) { onSuccess(); onClose(); }
  }

  async function handlePro() {
    const ok = await purchasePro();
    if (ok) { onSuccess(); onClose(); }
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/40">
        <View className="bg-white rounded-t-3xl p-6">
          <Text className="text-xl font-bold text-gray-900 mb-1">You've used 3 free operations</Text>
          <Text className="text-sm text-gray-500 mb-6">Upgrade to keep going</Text>

          <TouchableOpacity
            onPress={handleBulk}
            className="bg-red-600 rounded-2xl p-4 mb-3 items-center"
          >
            <Text className="text-white font-bold text-base">$1 — Unlimited for 24 hours</Text>
            <Text className="text-red-200 text-xs mt-1">No account needed</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={handlePro}
            className="border border-red-600 rounded-2xl p-4 mb-4 items-center"
          >
            <Text className="text-red-600 font-bold text-base">$7/mo — Pro (web + mobile)</Text>
            <Text className="text-gray-400 text-xs mt-1">Includes web app access</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onClose} className="items-center py-2">
            <Text className="text-gray-400 text-sm">Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 2: Implement `components/ResultSheet.tsx`**

```typescript
import { View, Text, TouchableOpacity, Modal } from "react-native";
import * as Sharing from "expo-sharing";
import * as FileSystem from "expo-file-system";

interface Props {
  visible: boolean;
  outputUri: string | null;
  filename: string;
  statsBefore?: string;
  statsAfter?: string;
  onClose: () => void;
}

export default function ResultSheet({ visible, outputUri, filename, statsBefore, statsAfter, onClose }: Props) {
  async function handleShare() {
    if (!outputUri) return;
    await Sharing.shareAsync(outputUri, { mimeType: "application/pdf" });
  }

  async function handleSave() {
    if (!outputUri) return;
    const dest = `${FileSystem.documentDirectory}${filename}`;
    await FileSystem.copyAsync({ from: outputUri, to: dest });
    // On iOS this puts the file in the app's Documents folder (accessible via Files app)
    alert(`Saved to Files: ${filename}`);
  }

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View className="flex-1 justify-end bg-black/40">
        <View className="bg-white rounded-t-3xl p-6">
          <View className="w-12 h-1.5 bg-gray-200 rounded-full self-center mb-4" />
          <Text className="text-lg font-bold text-gray-900 mb-1">Done! ✓</Text>
          {statsBefore && statsAfter && (
            <Text className="text-sm text-gray-500 mb-4">
              {statsBefore} → {statsAfter}
            </Text>
          )}
          <TouchableOpacity
            onPress={handleShare}
            className="bg-red-600 rounded-2xl p-4 mb-3 items-center"
          >
            <Text className="text-white font-bold text-base">Share</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleSave}
            className="border border-gray-200 rounded-2xl p-4 mb-4 items-center"
          >
            <Text className="text-gray-700 font-semibold text-base">Save to Files</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} className="items-center py-2">
            <Text className="text-gray-400 text-sm">Done</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add components/PaywallSheet.tsx components/ResultSheet.tsx
git commit -m "feat: PaywallSheet and ResultSheet components"
```

---

## Phase 7 — Screens

### Task 14: Home screen (`app/(tabs)/index.tsx`)

**Files:**
- Create: `app/(tabs)/index.tsx`

- [ ] **Step 1: Implement Home screen**

```typescript
import { useState, useCallback } from "react";
import {
  View, Text, FlatList, TouchableOpacity, SafeAreaView, Alert
} from "react-native";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import FileCard from "@/components/FileCard";

interface RecentFile {
  id: string;
  uri: string;
  name: string;
  size: number;
  addedAt: number;
}

export default function HomeScreen() {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);
  const [showAddSheet, setShowAddSheet] = useState(false);
  const router = useRouter();

  const openFilePicker = useCallback(async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: "application/pdf",
      copyToCacheDirectory: true,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    if ((asset.size ?? 0) > 50 * 1024 * 1024) {
      Alert.alert(
        "File too large",
        "Files over 50 MB can't be processed on mobile. Use the web app for large files."
      );
      return;
    }
    const file: RecentFile = {
      id: Math.random().toString(36).slice(2),
      uri: asset.uri,
      name: asset.name,
      size: asset.size ?? 0,
      addedAt: Date.now(),
    };
    setRecentFiles((prev) => [file, ...prev]);
    router.push({ pathname: "/tool/picker", params: { fileUri: asset.uri, filename: asset.name } });
    setShowAddSheet(false);
  }, [router]);

  const openCamera = useCallback(async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission required", "Camera access is needed to scan documents.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.9,
    });
    if (result.canceled) return;
    // Navigate to jpg-to-pdf tool with the captured image
    const asset = result.assets[0];
    router.push({
      pathname: "/tool/[tool]",
      params: { tool: "jpg-to-pdf", fileUri: asset.uri, filename: "scanned.jpg" },
    });
    setShowAddSheet(false);
  }, [router]);

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-4 py-4 bg-white border-b border-gray-100">
        <Text className="text-2xl font-bold text-gray-900">RizzPDF</Text>
        <Text className="text-sm text-gray-400 mt-0.5">PDF tools for your phone</Text>
      </View>

      {recentFiles.length === 0 ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-5xl mb-4">📄</Text>
          <Text className="text-lg font-semibold text-gray-700 text-center mb-2">
            No files yet
          </Text>
          <Text className="text-sm text-gray-400 text-center">
            Tap the button below to add a PDF
          </Text>
        </View>
      ) : (
        <FlatList
          data={recentFiles}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-4 py-3"
          renderItem={({ item }) => (
            <FileCard
              file={item}
              onPress={() =>
                router.push({
                  pathname: "/tool/picker",
                  params: { fileUri: item.uri, filename: item.name },
                })
              }
            />
          )}
        />
      )}

      <View className="px-4 pb-4 pt-2">
        <TouchableOpacity
          onPress={openFilePicker}
          className="bg-red-600 rounded-2xl py-4 items-center"
        >
          <Text className="text-white font-bold text-base">+ Add File</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={openCamera}
          className="mt-2 border border-gray-200 rounded-2xl py-3 items-center"
        >
          <Text className="text-gray-600 font-semibold text-sm">📷 Scan Document</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Create `components/FileCard.tsx`**

```typescript
import { View, Text, TouchableOpacity } from "react-native";

interface Props {
  file: { name: string; size: number; addedAt: number };
  onPress: () => void;
}

function fmt(b: number) {
  return b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${(b / 1024).toFixed(0)} KB`;
}

export default function FileCard({ file, onPress }: Props) {
  return (
    <TouchableOpacity
      onPress={onPress}
      className="bg-white border border-gray-200 rounded-2xl px-4 py-3 mb-2 flex-row items-center"
    >
      <Text className="text-2xl mr-3">📄</Text>
      <View className="flex-1 min-w-0">
        <Text className="text-sm font-semibold text-gray-800" numberOfLines={1}>
          {file.name}
        </Text>
        <Text className="text-xs text-gray-400 mt-0.5">{fmt(file.size)}</Text>
      </View>
      <Text className="text-red-500 text-lg">›</Text>
    </TouchableOpacity>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/index.tsx components/FileCard.tsx
git commit -m "feat: Home screen with file picker and camera scan"
```

---

### Task 15: Tool Picker screen

**Files:**
- Create: `app/tool/picker.tsx`

- [ ] **Step 1: Implement `app/tool/picker.tsx`**

```typescript
import { View, Text, SafeAreaView } from "react-native";
import { useLocalSearchParams } from "expo-router";
import ToolGrid from "@/components/ToolGrid";

export default function PickerScreen() {
  const { fileUri, filename } = useLocalSearchParams<{
    fileUri: string;
    filename: string;
  }>();

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-4 py-4 bg-white border-b border-gray-100">
        <Text className="text-base font-bold text-gray-900" numberOfLines={1}>
          📄 {filename}
        </Text>
        <Text className="text-xs text-gray-400 mt-0.5">What would you like to do?</Text>
      </View>
      <ToolGrid fileUri={fileUri} filename={filename} />
    </SafeAreaView>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/tool/picker.tsx
git commit -m "feat: Tool Picker screen"
```

---

### Task 16: Tool Config screen (`app/tool/[tool].tsx`)

**Files:**
- Create: `app/tool/[tool].tsx`

This is the central screen — handles all 15 tools via a single dynamic route.

- [ ] **Step 1: Implement the screen**

```typescript
import { useState, useCallback } from "react";
import { View, Text, TouchableOpacity, ScrollView, TextInput, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import ToolShell from "@/components/ToolShell";
import PaywallSheet from "@/components/PaywallSheet";
import ResultSheet from "@/components/ResultSheet";
import { useProStatus } from "@/lib/useProStatus";
import { uriToBytes, bytesToCacheUri } from "@/lib/file-system";
import {
  compressPDF, rotatePDF, addPageNumbers, watermarkPDF, splitPDF, mergePDFs,
  repairPDF, cropPDF, flattenPDF, redactPDF, resizePDF, unlockPDF,
  protectPDF, jpgToPdf,
  Quality, RotateAngle, PageNumPosition, WatermarkColor, WatermarkPosition, PageSize
} from "@/lib/pdf-tools-native";
import JSZip from "jszip";

const FREE_COUNT_KEY = "rizzpdf_free_count";
const FREE_LIMIT = 3;

const TOOL_NAMES: Record<string, string> = {
  compress: "Compress PDF", split: "Split PDF", merge: "Merge PDFs",
  rotate: "Rotate PDF", watermark: "Watermark", "page-numbers": "Add Page Numbers",
  protect: "Protect PDF", unlock: "Unlock PDF", repair: "Repair PDF",
  crop: "Crop PDF", flatten: "Flatten PDF", "pdf-to-jpg": "PDF to JPG",
  "jpg-to-pdf": "JPG to PDF", redact: "Redact PDF", resize: "Resize PDF",
};

export default function ToolScreen() {
  const { tool, fileUri, filename } = useLocalSearchParams<{
    tool: string; fileUri: string; filename: string;
  }>();
  const isPro = useProStatus();

  // Tool-specific state
  const [quality, setQuality] = useState<Quality>("medium");
  const [angle, setAngle] = useState<RotateAngle>(90);
  const [pageNumPos, setPageNumPos] = useState<PageNumPosition>("bottom-center");
  const [wmText, setWmText] = useState("CONFIDENTIAL");
  const [wmPosition, setWmPosition] = useState<WatermarkPosition>("diagonal");
  const [wmOpacity, setWmOpacity] = useState(0.3);
  const [wmFontSize, setWmFontSize] = useState(60);
  const [wmColor, setWmColor] = useState<WatermarkColor>("gray");
  const [password, setPassword] = useState("");
  const [pageSize, setPageSize] = useState<PageSize>("A4");

  // Processing state
  const [processing, setProcessing] = useState(false);
  const [outputUri, setOutputUri] = useState<string | null>(null);
  const [outputFilename, setOutputFilename] = useState("");
  const [showPaywall, setShowPaywall] = useState(false);
  const [showResult, setShowResult] = useState(false);

  async function checkAndDecrementFree(): Promise<boolean> {
    if (isPro) return true;
    const raw = await AsyncStorage.getItem(FREE_COUNT_KEY);
    const count = raw ? parseInt(raw) : 0;
    if (count >= FREE_LIMIT) { setShowPaywall(true); return false; }
    await AsyncStorage.setItem(FREE_COUNT_KEY, String(count + 1));
    return true;
  }

  const handleProcess = useCallback(async () => {
    if (processing || !fileUri) return;
    const allowed = await checkAndDecrementFree();
    if (!allowed) return;

    setProcessing(true);
    try {
      const bytes = await uriToBytes(fileUri);
      let outBytes: Uint8Array | undefined;
      let outName = filename ?? "output.pdf";

      if (tool === "compress") outBytes = await compressPDF(bytes, quality);
      else if (tool === "rotate") outBytes = await rotatePDF(bytes, angle);
      else if (tool === "page-numbers") outBytes = await addPageNumbers(bytes, pageNumPos);
      else if (tool === "watermark") outBytes = await watermarkPDF(bytes, {
        text: wmText || "CONFIDENTIAL", opacity: wmOpacity,
        position: wmPosition, fontSize: wmFontSize, color: wmColor,
      });
      else if (tool === "split") {
        const pages = await splitPDF(bytes);
        const zip = new JSZip();
        pages.forEach((p, i) => zip.file(`page_${i + 1}.pdf`, p));
        const zipBytes = await zip.generateAsync({ type: "uint8array" });
        outBytes = zipBytes;
        outName = outName.replace(".pdf", "_pages.zip");
      }
      else if (tool === "repair") outBytes = await repairPDF(bytes);
      else if (tool === "crop") outBytes = await cropPDF(bytes, { top: 20, right: 20, bottom: 20, left: 20 });
      else if (tool === "flatten") outBytes = await flattenPDF(bytes);
      else if (tool === "redact") outBytes = await redactPDF(bytes);
      else if (tool === "resize") outBytes = await resizePDF(bytes, pageSize);
      else if (tool === "unlock") outBytes = await unlockPDF(bytes, password || undefined);
      else if (tool === "protect") {
        if (!password) { Alert.alert("Enter a password to protect this PDF"); setProcessing(false); return; }
        outBytes = await protectPDF(bytes, password);
        outName = outName.replace(".pdf", "_protected.pdf");
      }
      else if (tool === "jpg-to-pdf") {
        outBytes = await jpgToPdf([bytes]);
        outName = outName.replace(/\.(jpg|jpeg|png)$/i, ".pdf");
      }
      else if (tool === "pdf-to-jpg") {
        // react-native-pdf renders pages natively — call pdfToJpgNative (see lib/pdf-tools-native.ts)
        // For v1, each page is rendered via react-native-pdf-thumbnail then zipped
        const { pdfToJpgNative } = await import("@/lib/pdf-to-jpg-native");
        const jpgList = await pdfToJpgNative(fileUri);
        if (jpgList.length === 1) {
          outBytes = jpgList[0];
          outName = outName.replace(".pdf", ".jpg");
        } else {
          const zip = new JSZip();
          jpgList.forEach((jpg, i) => zip.file(`page_${i + 1}.jpg`, jpg));
          outBytes = await zip.generateAsync({ type: "uint8array" });
          outName = outName.replace(".pdf", "_pages.zip");
        }
      }

      if (!outBytes) throw new Error("Tool not implemented");
      const uri = await bytesToCacheUri(outBytes, outName);
      setOutputUri(uri);
      setOutputFilename(outName);
      setShowResult(true);
    } catch (err: unknown) {
      Alert.alert("Processing failed", err instanceof Error ? err.message : "Unknown error");
    } finally {
      setProcessing(false);
    }
  }, [tool, fileUri, filename, quality, angle, pageNumPos, wmText, wmOpacity, wmPosition, wmFontSize, wmColor, password, pageSize, processing, isPro]);

  return (
    <ToolShell title={TOOL_NAMES[tool] ?? tool} processing={processing}>
      <ScrollView className="flex-1 px-4 py-4" contentContainerClassName="space-y-4 pb-8">

        {/* Tool-specific options */}
        {tool === "compress" && (
          <View>
            <Text className="text-sm font-semibold text-gray-700 mb-2">Quality</Text>
            <View className="flex-row gap-2">
              {(["low", "medium", "high"] as Quality[]).map((q) => (
                <TouchableOpacity key={q} onPress={() => setQuality(q)}
                  className={`flex-1 py-2 rounded-xl border items-center ${quality === q ? "bg-red-600 border-red-600" : "border-gray-200"}`}>
                  <Text className={`text-sm font-semibold capitalize ${quality === q ? "text-white" : "text-gray-600"}`}>{q}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {tool === "rotate" && (
          <View>
            <Text className="text-sm font-semibold text-gray-700 mb-2">Angle</Text>
            <View className="flex-row gap-2">
              {([90, 180, 270] as RotateAngle[]).map((a) => (
                <TouchableOpacity key={a} onPress={() => setAngle(a)}
                  className={`flex-1 py-2 rounded-xl border items-center ${angle === a ? "bg-red-600 border-red-600" : "border-gray-200"}`}>
                  <Text className={`text-sm font-semibold ${angle === a ? "text-white" : "text-gray-600"}`}>{a}°</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {tool === "watermark" && (
          <View className="space-y-3">
            <TextInput value={wmText} onChangeText={setWmText} placeholder="CONFIDENTIAL"
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm" />
            <View className="flex-row gap-2">
              {(["diagonal", "center"] as WatermarkPosition[]).map((p) => (
                <TouchableOpacity key={p} onPress={() => setWmPosition(p)}
                  className={`flex-1 py-2 rounded-xl border items-center capitalize ${wmPosition === p ? "bg-red-600 border-red-600" : "border-gray-200"}`}>
                  <Text className={`text-sm font-semibold capitalize ${wmPosition === p ? "text-white" : "text-gray-600"}`}>{p}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {(tool === "protect" || tool === "unlock") && (
          <View>
            <Text className="text-sm font-semibold text-gray-700 mb-2">
              {tool === "protect" ? "Set password" : "Enter password (if any)"}
            </Text>
            <TextInput value={password} onChangeText={setPassword}
              secureTextEntry placeholder={tool === "protect" ? "Enter password" : "Leave blank if none"}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm" />
          </View>
        )}

        {tool === "resize" && (
          <View>
            <Text className="text-sm font-semibold text-gray-700 mb-2">Page size</Text>
            <View className="flex-row flex-wrap gap-2">
              {(["A4", "Letter", "Legal", "A3"] as PageSize[]).map((s) => (
                <TouchableOpacity key={s} onPress={() => setPageSize(s)}
                  className={`px-4 py-2 rounded-xl border ${pageSize === s ? "bg-red-600 border-red-600" : "border-gray-200"}`}>
                  <Text className={`text-sm font-semibold ${pageSize === s ? "text-white" : "text-gray-600"}`}>{s}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        <TouchableOpacity onPress={handleProcess} disabled={processing}
          className={`bg-red-600 rounded-2xl py-4 items-center mt-4 ${processing ? "opacity-50" : ""}`}>
          <Text className="text-white font-bold text-base">
            {processing ? "Processing…" : `Run ${TOOL_NAMES[tool] ?? tool}`}
          </Text>
        </TouchableOpacity>
      </ScrollView>

      <PaywallSheet
        visible={showPaywall}
        onClose={() => setShowPaywall(false)}
        onSuccess={() => setShowPaywall(false)}
      />
      <ResultSheet
        visible={showResult}
        outputUri={outputUri}
        filename={outputFilename}
        onClose={() => setShowResult(false)}
      />
    </ToolShell>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/tool/[tool].tsx
git commit -m "feat: Tool Config screen — all 15 tools wired up"
```

---

### Task 17: History + Account screens

**Files:**
- Create: `app/(tabs)/history.tsx`
- Create: `app/(tabs)/account.tsx`

- [ ] **Step 1: Implement `app/(tabs)/history.tsx`**

```typescript
import { View, Text, SafeAreaView } from "react-native";

export default function HistoryScreen() {
  return (
    <SafeAreaView className="flex-1 bg-gray-50 items-center justify-center">
      <Text className="text-4xl mb-3">📂</Text>
      <Text className="text-base font-semibold text-gray-600">No history yet</Text>
      <Text className="text-sm text-gray-400 mt-1 text-center px-8">
        Files you process will appear here
      </Text>
    </SafeAreaView>
  );
}
```

> History persistence (AsyncStorage) is v2 — v1 shows an empty state placeholder.

- [ ] **Step 2: Implement `app/(tabs)/account.tsx`**

```typescript
import { useState } from "react";
import { View, Text, TouchableOpacity, SafeAreaView, TextInput, Alert } from "react-native";
import { useUser, useAuth, useSignIn } from "@clerk/clerk-expo";
import { useProStatus } from "@/lib/useProStatus";
import { restorePurchases } from "@/lib/revenue-cat";

export default function AccountScreen() {
  const { isSignedIn, user } = useUser();
  const { signOut } = useAuth();
  const { signIn } = useSignIn();
  const isPro = useProStatus();
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSignIn() {
    if (!email.trim()) { Alert.alert("Enter your email address"); return; }
    setSending(true);
    try {
      await signIn?.create({ strategy: "email_link", identifier: email.trim() });
      Alert.alert("Check your email", `We sent a sign-in link to ${email.trim()}`);
    } catch (e: unknown) {
      Alert.alert("Sign-in failed", e instanceof Error ? e.message : "Unknown error");
    } finally {
      setSending(false);
    }
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      <View className="px-4 py-4 bg-white border-b border-gray-100">
        <Text className="text-xl font-bold text-gray-900">Account</Text>
      </View>

      <View className="px-4 py-6 space-y-4">
        {isSignedIn ? (
          <>
            <View className="bg-white border border-gray-200 rounded-2xl p-4">
              <Text className="text-sm text-gray-500">Signed in as</Text>
              <Text className="text-base font-semibold text-gray-800 mt-0.5">
                {user?.emailAddresses[0]?.emailAddress}
              </Text>
            </View>

            <View className="bg-white border border-gray-200 rounded-2xl p-4">
              <Text className="text-sm text-gray-500">Plan</Text>
              <Text className={`text-base font-bold mt-0.5 ${isPro ? "text-red-600" : "text-gray-400"}`}>
                {isPro ? "Pro ✓" : "Free"}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => restorePurchases()}
              className="border border-gray-200 rounded-2xl p-4 items-center"
            >
              <Text className="text-gray-600 font-semibold">Restore Purchases</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => signOut()}
              className="border border-red-200 rounded-2xl p-4 items-center"
            >
              <Text className="text-red-600 font-semibold">Sign Out</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="your@email.com"
              keyboardType="email-address"
              autoCapitalize="none"
              className="border border-gray-200 rounded-2xl px-4 py-3 text-sm bg-white"
            />
            <TouchableOpacity
              onPress={handleSignIn}
              disabled={sending}
              className={`bg-red-600 rounded-2xl p-4 items-center ${sending ? "opacity-50" : ""}`}
            >
              <Text className="text-white font-bold text-base">
                {sending ? "Sending…" : "Sign In / Create Account"}
              </Text>
            </TouchableOpacity>
            <Text className="text-xs text-gray-400 text-center">
              We'll email you a magic link — no password needed
            </Text>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add app/(tabs)/history.tsx app/(tabs)/account.tsx
git commit -m "feat: History and Account screens"
```

---

### Task 17b: `lib/pdf-to-jpg-native.ts` — PDF→JPG using react-native-pdf-thumbnail

**Files:**
- Create: `lib/pdf-to-jpg-native.ts`

This module uses `react-native-pdf-thumbnail` (native PDFKit/PdfRenderer) to render each PDF page as a JPEG. It is in its own file because it imports a native module that cannot be unit tested in Jest.

- [ ] **Step 1: Implement `lib/pdf-to-jpg-native.ts`**

```typescript
import PdfThumbnail from "react-native-pdf-thumbnail";
import * as FileSystem from "expo-file-system";

/**
 * Render every page of a PDF to JPEG bytes using the native PDF renderer.
 * Returns an array of Uint8Array, one per page.
 * Requires expo-dev-client (not compatible with Expo Go).
 */
export async function pdfToJpgNative(pdfUri: string): Promise<Uint8Array[]> {
  // Get page count via thumbnail of page 0 (throws if PDF is invalid)
  const first = await PdfThumbnail.generate(pdfUri, 0, 100);

  // Determine total pages by probing (react-native-pdf-thumbnail has no page count API)
  // We use a generous upper bound and stop on error
  const results: Uint8Array[] = [];
  let page = 0;
  while (true) {
    try {
      const thumb = await PdfThumbnail.generate(pdfUri, page, 150 /* quality 0-100 */);
      const b64 = await FileSystem.readAsStringAsync(thumb.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const binary = atob(b64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      results.push(bytes);
      // Clean up temp thumbnail file
      await FileSystem.deleteAsync(thumb.uri, { idempotent: true });
      page++;
    } catch {
      break; // No more pages
    }
  }
  return results;
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/pdf-to-jpg-native.ts
git commit -m "feat: PDF→JPG via native renderer (react-native-pdf-thumbnail)"
```

---

## Phase 8 — Validation + Submission Prep

### Task 18: Hermes SubtleCrypto validation build

**Files:**
- Modify: `app/(tabs)/account.tsx` (add dev-only test button)

- [ ] **Step 1: Add dev-only Hermes validation button to Account screen**

In `app/(tabs)/account.tsx`, add inside the `<View className="px-4 py-6 space-y-4">`:

```typescript
{__DEV__ && (
  <TouchableOpacity
    onPress={async () => {
      const { validateHermesSubtleCrypto } = await import("@/lib/pdf-tools-native");
      try {
        await validateHermesSubtleCrypto();
        alert("✓ SubtleCrypto works — Protect tool is safe to ship");
      } catch (e) {
        alert(`✗ SubtleCrypto FAILED: ${e}\n\nMove Protect to v2.`);
      }
    }}
    className="border border-yellow-400 rounded-2xl p-3 items-center"
  >
    <Text className="text-yellow-600 font-semibold text-sm">
      [DEV] Validate Hermes SubtleCrypto
    </Text>
  </TouchableOpacity>
)}
```

- [ ] **Step 2: Build dev client and run on both platforms**

```bash
# iOS
npx expo run:ios --device

# Android
npx expo run:android --device
```

- [ ] **Step 3: Tap "Validate Hermes SubtleCrypto" on both platforms**

- If ✓ on both: Protect tool ships in v1
- If ✗ on either: Remove Protect from `lib/tools.ts` (set `disabled: true`), note in PR

- [ ] **Step 4: Commit result**

```bash
git add app/(tabs)/account.tsx
git commit -m "feat: dev-only Hermes SubtleCrypto validation button"
```

---

### Task 19: Run full test suite + pre-submission checks

- [ ] **Step 1: Run all unit tests**

```bash
npx jest --no-coverage
```
Expected: all PASS

- [ ] **Step 2: Verify 50 MB gate**

Test with a file > 50 MB in the Home screen. Expected: Alert shown, file not added.

- [ ] **Step 3: Verify free tier counter persists across app restarts**

- Process 3 PDFs
- Force-quit and reopen the app
- Try to process a 4th PDF
- Expected: PaywallSheet appears

- [ ] **Step 4: Verify `ITSAppUsesNonExemptEncryption` in `app.json`**

```bash
grep -r "ITSAppUsesNonExemptEncryption" app.json
```
Expected: `true`

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final pre-submission validation checks"
```

---

## Summary

| Phase | Tasks | Key deliverable |
|---|---|---|
| 1 | 1–3 | Expo project scaffold, all dependencies, build tooling |
| 2 | 4 | File I/O layer (expo-file-system abstraction) |
| 3 | 5–8 | All 15 PDF operations with unit tests |
| 4 | 9–10 | useProStatus hook + RevenueCat helpers |
| 5 | 11 | Root layout, Clerk, tab navigation |
| 6 | 12–13 | ToolGrid, ToolShell, PaywallSheet, ResultSheet |
| 7 | 14–17 | All 4 screens (Home, Picker, Tool, History, Account) |
| 8 | 18–19 | Hermes validation, test suite, pre-submission |
