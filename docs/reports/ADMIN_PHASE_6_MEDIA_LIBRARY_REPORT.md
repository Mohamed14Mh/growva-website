# GROWVA CMS Phase 6 — Media Library Implementation Report

## What Was Built

Phase 6 adds a Supabase Storage-powered media library to the existing static HTML/CSS/JS CMS. No server backend, no service-role key. All access is enforced by Supabase RLS.

---

## Files Created / Modified

### New Files

| File | Purpose |
|------|---------|
| `supabase/phase-6-media-library.sql` | SQL patch: `cms_media_assets` table + RLS + Storage bucket policies |
| `SUPABASE_MEDIA_SETUP_GUIDE.md` | Step-by-step setup, troubleshooting, and RLS explanation |
| `ADMIN_PHASE_6_MEDIA_LIBRARY_REPORT.md` | This report |

### Modified Files

| File | What Changed |
|------|-------------|
| `admin/admin.js` | Media Library tab, upload pipeline, image inspector, image hydration, debug logging |
| `admin/admin.css` | Media grid, upload area, image preview, thumbnail in draft rows |

---

## Database Changes

### New Table: `public.cms_media_assets`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid | Primary key, auto-generated |
| `storage_path` | text | Unique path in `cms-media` bucket |
| `public_url` | text | Full Supabase public URL |
| `file_name` | text | Sanitized filename |
| `file_type` | text | MIME type (jpeg/png/webp) |
| `file_size` | bigint | Bytes |
| `width` | int | Detected client-side via Image() API |
| `height` | int | Detected client-side via Image() API |
| `alt_text` | text | Editable metadata, defaults to `''` |
| `caption` | text | Optional caption, defaults to `''` |
| `folder` | text | Always `'cms'` for now |
| `uploaded_by` | uuid | References `auth.users(id)` |
| `created_at` / `updated_at` | timestamptz | Auto-managed |

### New Storage Bucket (manual step in Dashboard)
- **Name**: `cms-media`
- **Visibility**: Public (objects are readable without authentication)

---

## RLS Policy Summary

### `cms_media_assets` table

| Policy | Who | Action |
|--------|-----|--------|
| Public can read media assets | `anon`, `authenticated` | SELECT |
| Editors and owners can insert media assets | `editor`, `owner` | INSERT |
| Editors and owners can update media assets | `editor`, `owner` | UPDATE |
| Owners can delete media assets | `owner` | DELETE |

### `storage.objects` (bucket: `cms-media`)

| Policy | Who | Action |
|--------|-----|--------|
| Public can read cms-media objects | `anon`, `authenticated` | SELECT |
| Editors and owners can upload to cms-media | `editor`, `owner` | INSERT |
| Editors and owners can update cms-media objects | `editor`, `owner` | UPDATE |
| Owners can delete cms-media objects | `owner` | DELETE |

---

## New JavaScript Functions (admin/admin.js)

| Function | Purpose |
|----------|---------|
| `sanitizeFileName(name)` | Lowercases, strips non-alphanumeric chars, truncates to 80 chars |
| `detectImageDimensions(file)` | Returns `{width, height}` via client-side `Image()` API |
| `isSafeImageUrl(url)` | Validates URL: allows Supabase storage, https://, relative. Blocks `javascript:` and `data:` |
| `getImageValueFromRow(row)` | Parses `value_json` safely from a CMS content row |
| `formatFileSize(bytes)` | Human-readable file size (B / KB / MB) |
| `loadMediaAssets()` | Fetches up to 200 assets from `cms_media_assets`, newest first |
| `uploadMediaFile(file)` | Validates → sanitizes → uploads to Storage → inserts asset record |
| `insertMediaAuditLog(action, key, details)` | Best-effort audit log write using existing `cms_audit_log` table |
| `renderMediaLibraryTab()` | Builds the Media Library dashboard tab HTML |
| `renderMediaGrid()` | Renders the asset grid (or empty/loading states) |
| `bindMediaUploadAreaEvents()` | Attaches drag-drop and file-input events to the upload area (idempotent via `_mediaBound` flag) |
| `handleMediaFileInput(files)` | Loops over selected files, uploads each, updates grid |
| `selectMediaAsset(assetId)` | Marks asset as selected; fills URL in image inspector if open |
| `copyMediaUrl(url)` | Copies asset URL to clipboard via `navigator.clipboard` |
| `renderImageInspector(element)` | Image-specific inspector panel (preview, URL, alt, library picker) |
| `bindImageUrlLivePreview()` | Live-updates the preview image as URL is typed |
| `bindImageInspectorFileInput()` | Binds file input change in the inspector (idempotent) |
| `handleInspectorImageUpload(file)` | Uploads a file from the inspector's Upload New button |
| `saveImageDraft()` | Saves image URL + alt + media_asset_id as `value_json` in `cms_content` |
| `resetImageDraft()` | Deletes draft row; restores published or original image |
| `restoreImageFromPublishedOrOriginal(key)` | Reverts element to published value or captured original |
| `applyImageValueToElement(element, valueJson)` | Sets `img.src` / `img.alt` or `background-image` safely |
| `applyPublishedImageEdits()` | On page load, fetches published image rows and applies them |
| `logCmsMediaDebug(context, extra)` | Logs media-specific debug info when `?cmsDebug=true` |

---

## Changes to Existing Functions

| Function | Change |
|----------|--------|
| State variables | Added `mediaAssets`, `mediaUploadInFlight`, `mediaSelectedAssetId`, `mediaLibraryLoaded` |
| `renderDashboard` tabs | Added `['media', 'Media Library']` tab |
| `renderDashboardTab` | Added `if (dashboardTab === 'media') return renderMediaLibraryTab();` |
| `renderContentRow` | Shows `<img>` thumbnail for rows with `edit_type === 'image'` or `'background-image'` |
| `renderInspector` | Redirects to `renderImageInspector` for image/background-image edit types |
| `handleAdminClick` | Added 8 new action handlers for media and image operations |
| `openDashboard` | Calls `bindMediaUploadAreaEvents()` after render |
| `switchDashboardTab` | Calls `bindMediaUploadAreaEvents()` when switching to media tab |
| `refreshDashboardData` | Calls `loadMediaAssets()` on dashboard refresh |
| `enterAdminMode` | Calls `loadMediaAssets()` after `loadDraftEdits()` |
| `boot` | Calls `applyPublishedImageEdits()` after `loadPublishedEdits()` (for both anonymous visitors and re-auth) |
| `logCmsDebug` | Added `media_assets_count`, `media_library_loaded`, `selected_asset_id` |

---

## Upload Flow Details

1. User drops or selects file(s)
2. `uploadMediaFile(file)` validates:
   - Type: must be `image/jpeg`, `image/png`, or `image/webp` (SVG **disabled**)
   - Size: must be ≤ 5 MB
3. `sanitizeFileName(name)` produces a safe filename:  
   `"My Photo.JPG"` → `"my-photo.jpg"`
4. Storage path: `cms/YYYY/MM/{timestamp}-{safename}.ext`
5. `detectImageDimensions(file)` measures width/height via `Image()` API
6. `supabaseClient.storage.from('cms-media').upload(...)` uploads the file
7. `supabaseClient.storage.from('cms-media').getPublicUrl(...)` retrieves the public URL
8. `supabaseClient.from('cms_media_assets').insert(...)` creates the asset record
9. `insertMediaAuditLog('media_upload', ...)` logs the action (best-effort)

---

## Image Editing Flow

1. Admin clicks element with `data-edit-type="image"` or `data-edit-type="background-image"`
2. Inspector shows `renderImageInspector()` instead of text inspector
3. Admin can:
   - Paste a URL directly into the URL field
   - Click **Media Library** → pick an asset → URL auto-fills
   - Click **Upload New** → file picker → uploads and auto-fills URL
4. Click **Save Draft Image** → `saveImageDraft()` writes to `cms_content` with `value_json: { url, alt, media_asset_id, field }`
5. Click **Publish** (topbar) → existing publish flow publishes the image row alongside any text rows
6. On next page load, `applyPublishedImageEdits()` restores the published image

---

## `value_json` Format for Image Fields

```json
{
  "url": "https://project.supabase.co/storage/v1/object/public/cms-media/cms/2026/07/1751234567890-hero.jpg",
  "alt": "Team photo in office",
  "media_asset_id": "a1b2c3d4-...",
  "field": "src"
}
```

- `url` — the image URL applied to `img.src` or `background-image`
- `alt` — text applied to `img.alt`
- `media_asset_id` — UUID of the `cms_media_assets` row (nullable for externally-hosted URLs)
- `field` — `"src"` for `<img>` elements, `"background-image"` for CSS backgrounds

---

## Audit Log Actions (Phase 6)

| Action | When |
|--------|------|
| `media_upload` | After successful file upload |
| `image_draft_save` | After saving an image draft |
| `image_reset` | After resetting an image draft |

All are written to the existing `cms_audit_log` table and are best-effort (failures do not block the main action).

---

## Debug Mode (`?cmsDebug=true`)

Phase 6 adds these log messages to the existing CMS debug output:

```
[GROWVA CMS Media Debug] load-assets-ok     { count: 12 }
[GROWVA CMS Media Debug] upload-ok          { storagePath, publicUrl, width, height }
[GROWVA CMS Media Debug] upload-error       { error: "..." }
[GROWVA CMS Media Debug] asset-selected     { assetId, url }
[GROWVA CMS Media Debug] image-draft-save-ok { key, url }
[GROWVA CMS Media Debug] image-draft-save-mock { key, url }
[GROWVA CMS Media Debug] hydration-ok       { count: 3 }
```

The main `[GROWVA CMS Debug]` object now also includes:
- `media_assets_count`
- `media_library_loaded`
- `selected_asset_id`

---

## Security Notes

- **No service-role key**: the anon key is used throughout; RLS is the enforcement layer.
- **No SVG uploads**: `image/svg+xml` is blocked client-side to prevent embedded script injection. Document this when enabling SVG later.
- **URL validation**: `isSafeImageUrl()` blocks `javascript:` and all `data:` schemes before setting `img.src` or `background-image`.
- **Filename sanitization**: `sanitizeFileName()` removes non-alphanumeric characters before constructing the storage path.
- **File type validation**: MIME type is checked, not just extension.
- **File size cap**: 5 MB enforced client-side before the upload is attempted.
- **RLS is real security**: client-side role checks display helpful messages but cannot prevent a determined attacker. The database policies are the authoritative gate.

---

## What Was Not Done (By Spec)

- No global publish
- No section builder
- No redesign of the website or rendering layer
- No changes to GSAP, Lenis, Three.js, Flip, page transitions, mega menu, mobile menu, or custom cursor
- No changes to existing text CMS save/publish/reset flow
- No changes to Supabase Auth

---

## Image Field Markers

No `<img>` elements exist in the current site HTML (all visuals are CSS/SVG mockups). When real images are added, mark them up as:

```html
<img
  src="actual-image.jpg"
  alt="Description"
  data-edit-key="section-image-name"
  data-edit-type="image"
  data-section-id="section-name"
  data-media-key="section-image-name"
>
```

For CSS background image elements:
```html
<div
  class="hero-bg"
  data-edit-key="hero-bg"
  data-edit-type="background-image"
  data-section-id="hero"
  data-media-key="hero-bg"
></div>
```

Do **not** add markers to `.catv-*` / `.pgi-*` CSS mockup elements, Three.js canvases, or WebGL elements.

---

## Validation

```
node --check admin/admin.js    → OK (no syntax errors)
node --check js/script.js      → OK (no syntax errors)
node --check js/content-registry.js → OK (no syntax errors)
```
