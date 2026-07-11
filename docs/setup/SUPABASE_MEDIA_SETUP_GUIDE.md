# GROWVA CMS Phase 6 — Media Library Setup Guide

## Overview

Phase 6 adds a Supabase Storage-powered media library to the existing CMS.  
Admins (owner/editor) can upload images, browse them in a grid, and assign them to image fields on any page.  
Public visitors see the published images via hydration on page load.

No server backend is required. No service-role key is used anywhere.

---

## Step 1 — Create the Storage Bucket

1. Open your Supabase project dashboard.
2. Go to **Storage** in the left sidebar.
3. Click **New bucket**.
4. Set:
   - **Name**: `cms-media`  *(exact, lowercase, hyphen — must match the JS code)*
   - **Public bucket**: **ON** (checked)  
     Public means the generated object URLs work without a signed token, which is required for published images to load for anonymous visitors.
5. Click **Create bucket**.

---

## Step 2 — Apply the SQL Patch

1. Go to **SQL Editor** in the Supabase dashboard.
2. Paste or upload the contents of `supabase/phase-6-media-library.sql`.
3. Click **Run**.

This creates:
- `public.cms_media_assets` table with RLS enabled
- Storage policies on `storage.objects` for the `cms-media` bucket

> The Phase 3 `schema.sql` must already be applied (it defines `public.current_admin_role()` which Phase 6 policies depend on).

---

## Step 3 — Verify the Setup

After applying the SQL:

1. Sign in to the CMS admin panel on your site.
2. Open **CMS Dashboard** → **Media Library** tab.
3. If the bucket and policies are correct, you will see the empty media grid and an upload area.
4. Upload a test image (JPEG, PNG, or WebP, ≤ 5 MB).
5. The image should appear in the grid with its filename, dimensions, file size, and date.
6. Click **Copy URL** to verify the URL resolves in a browser.

---

## Step 4 — Add Image Markers to HTML Elements

To make an image field editable through the CMS inspector, add these attributes to `<img>` elements (or elements with CSS background images) in your HTML:

```html
<!-- Editable <img> element -->
<img
  src="placeholder.jpg"
  alt="Description"
  data-edit-key="hero-image"
  data-edit-type="image"
  data-section-id="hero"
  data-media-key="hero-image"
>

<!-- Editable CSS background element -->
<div
  class="hero-bg"
  data-edit-key="hero-bg"
  data-edit-type="background-image"
  data-section-id="hero"
  data-media-key="hero-bg"
></div>
```

- `data-edit-key` — unique key for this field (same as other CMS fields)
- `data-edit-type` — `"image"` for `<img>` tags, `"background-image"` for CSS backgrounds
- `data-section-id` — the section this field belongs to (for the section navigator)
- `data-media-key` — same value as `data-edit-key`; used for future media indexing

> Do **not** add these markers to Three.js canvases, WebGL elements, or CSS mockup divs (`.catv-*`, `.pgi-*`, etc.).

---

## How Upload Works

1. Admin selects file(s) via drag-and-drop or file picker.
2. Client validates: type must be JPEG, PNG, or WebP; size must be ≤ 5 MB.
3. Filename is sanitized: lowercased, non-alphanumeric characters replaced with `-`, truncated to 80 chars.
4. File is uploaded to Supabase Storage at path `cms/YYYY/MM/{timestamp}-{safename}.ext`.
5. Image dimensions are detected client-side via the `Image()` API.
6. A record is inserted into `public.cms_media_assets`.
7. The asset appears in the media grid immediately.

---

## How Image Editing Works

1. Enter Edit Mode in the CMS.
2. Click on any element with `data-edit-type="image"` or `data-edit-type="background-image"`.
3. The inspector panel shows:
   - Current image preview
   - URL field (manually enter or fill from Media Library)
   - Alt text field
   - **Media Library** button — opens the library tab to pick an asset
   - **Upload New** button — opens file picker inline
   - **Save Draft Image** — saves the image draft to Supabase
   - **Reset** — removes the draft, restoring published or hardcoded image
4. Click **Publish** (topbar) to publish all draft image changes for the current page.

---

## How Public Hydration Works

On every page load, the CMS applies published image edits:
1. Fetches published `cms_content` rows with `edit_type IN ('image', 'background-image')`.
2. For each row, finds the matching `[data-edit-key]` element.
3. Validates the URL: must be Supabase Storage URL, `https://`, or a relative path. Blocks `javascript:` and `data:` URIs.
4. Sets `img.src` and `img.alt`, or `element.style.backgroundImage`.

This runs before the user sees the page, so published images load immediately.

---

## RLS Policy Summary

| Action | Anon | Viewer | Editor | Owner |
|--------|------|--------|--------|-------|
| Read media assets | ✓ | ✓ | ✓ | ✓ |
| Upload images | ✗ | ✗ | ✓ | ✓ |
| Update asset metadata | ✗ | ✗ | ✓ | ✓ |
| Delete asset records | ✗ | ✗ | ✗ | ✓ |
| Read storage objects | ✓ | ✓ | ✓ | ✓ |
| Upload to storage | ✗ | ✗ | ✓ | ✓ |
| Delete from storage | ✗ | ✗ | ✗ | ✓ |

> **RLS is the real security layer.** The role checks in the JS are UX only — they show helpful messages but they do not replace database-level enforcement.

---

## Troubleshooting RLS

**Upload fails with "Storage upload failed":**
- Confirm the bucket name is exactly `cms-media` (no spaces, lowercase).
- Run the SQL patch again if you renamed the bucket.
- Check that your user is in `admin_profiles` with role `owner` or `editor`.

**Asset record inserts but image URL returns 403:**
- Verify the bucket is set to **Public** in Supabase Dashboard > Storage > Settings.
- Check `storage.objects` SELECT policy: "Public can read cms-media objects".

**Media Library tab shows "Sign in to access":**
- The tab requires an active Supabase session. Log in via the CMS admin entry button.

**Published images don't appear on reload:**
- Check that `cms_content` has published rows with `edit_type = 'image'`.
- Open DevTools > Console, add `?cmsDebug=true` to the URL — look for `[GROWVA CMS Media Debug] hydration-ok`.

**`cmsDebug=true` output for media:**
- `media_assets_count` — how many assets are in the library
- `media_library_loaded` — whether the asset list loaded successfully
- `selected_asset_id` — currently selected asset in the media grid
- `hydration-ok` — count of image fields hydrated on page load
- `upload-ok` — storage path and dimensions after a successful upload

---

## Why No Service-Role Key

The service-role key bypasses all RLS policies. If exposed in client-side JS (which any visitor can read), it grants full database access to anyone.

The anon/publishable key is safe because:
- RLS policies enforce role-based access at the database level.
- Uploads require an authenticated session with `owner` or `editor` role.
- Public read is intentional — published images must load for all visitors.

---

## Local Development Notes

- **`file://` protocol**: Media upload will not work when opening HTML files directly. Use **Live Server** (VS Code extension) or any local HTTP server (`npx serve .`).
- **GitHub Pages**: Upload works on GitHub Pages deployments. Ensure `supabase-config.js` is committed with your real project URL and anon key.
- A non-blocking warning is shown automatically in the CMS when running on `file://`.

---

## SVG Note

SVG uploads are **disabled** to prevent script injection via SVG files (SVGs can embed `<script>` tags). If you need SVG support, process SVGs through a server-side sanitizer (e.g., a Supabase Edge Function using DOMPurify) before storing. Client-side sanitization of SVGs is not reliable.
