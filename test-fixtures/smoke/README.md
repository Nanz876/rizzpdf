# RizzPDF Smoke Fixtures

These files are for manual end-to-end testing in the browser.

Files:
- `plain-text.pdf` - baseline text PDF
- `multi-page.pdf` - six-page document for split, rotate, organize, batch, and page-number tests
- `image-heavy.pdf` - image-dense PDF for compress behavior
- `protected-source.pdf` - unencrypted source used to derive protected variants
- `protected-user-password.pdf` - open password: `rizz123`
- `restricted-no-open-password.pdf` - opens without prompt but carries owner restrictions
- `malformed-source.pdf` - clean source for comparison
- `mildly-malformed.pdf` - same content with trailing junk bytes for repair tolerance tests

Passwords:
- User password: `rizz123`
- Owner password: `owner123`

Regenerate:
- `node scripts/generate-smoke-pdfs.mjs`
