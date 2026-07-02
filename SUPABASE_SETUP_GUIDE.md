# GROWVA Supabase Setup Guide

This project stays static HTML/CSS/JS. Supabase provides authentication, draft storage, publish storage, and public published-content reads.

## 1. Create A Supabase Project

1. Go to Supabase and create a new project.
2. Save the project password somewhere secure.
3. Wait for the project database and API to finish provisioning.

## 2. Install The CMS Schema

1. Open the Supabase dashboard.
2. Go to SQL Editor.
3. Open [supabase/schema.sql](supabase/schema.sql).
4. Paste the full SQL into the SQL Editor.
5. Run it once.

The schema creates:

- `admin_profiles`
- `cms_content`
- `cms_publish_log`
- `cms_audit_log`
- `public.current_admin_role()`
- RLS policies for public published reads, admin drafts, editor saves, and owner publishing.

## 3. Add Project URL And Anon Key

1. In Supabase, go to Project Settings.
2. Open API.
3. Copy the Project URL.
4. Copy the anon public key.
5. Update [admin/supabase-config.js](admin/supabase-config.js):

```js
window.GROWVA_SUPABASE_CONFIG = {
  url: "https://YOUR_PROJECT.supabase.co",
  anonKey: "YOUR_SUPABASE_ANON_KEY"
};
```

Do not commit real production secrets if this repo is public. The Supabase anon key is safe only when RLS policies stay strict.

## 4. Create The First Admin User

1. In Supabase, go to Authentication.
2. Create a user with email and password.
3. Confirm the user if email confirmations are enabled.
4. Copy the user's UUID from the Authentication Users table.

## 5. Insert The Admin Profile Row

In the SQL Editor, run:

```sql
insert into public.admin_profiles (id, email, role)
values (
  'PASTE_AUTH_USER_UUID_HERE',
  'admin@example.com',
  'owner'
);
```

Roles:

- `owner`: can save drafts and publish.
- `editor`: can save and reset drafts, but cannot publish.
- `viewer`: can enter admin mode and inspect content, but cannot save or publish.

## 6. Test Login

1. Run the site from a static server.
2. Open any page.
3. Click `Admin`.
4. Enter the Supabase Auth email and password.
5. Confirm the admin top bar appears in Preview mode.

If the modal says `Supabase is not configured yet`, check `admin/supabase-config.js`.

## 7. Test Saving Drafts

1. Log in as an `owner` or `editor`.
2. Switch to Edit mode.
3. Click a highlighted text field.
4. Change the field text.
5. Click `Save Draft`.
6. Confirm the inspector says `Draft saved`.
7. Reload the page while logged in and re-enter Admin mode.
8. Confirm the draft override loads over the hardcoded or published value.

## 8. Test Publishing

1. Log in as an `owner`.
2. Save one or more draft edits on the current page.
3. Click `Publish`.
4. Confirm `Publish all draft changes for this page?`.
5. Confirm the success message says `Published X changes`.
6. Log out or open a private browser window.
7. Reload the same page.
8. Confirm the published text appears for public visitors.

Phase 3 publishes the current page only.

## 9. Common Errors And Fixes

`Supabase is not configured yet.`
: Replace the placeholder values in `admin/supabase-config.js`.

`Supabase library missing.`
: Confirm every HTML page loads `https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2` before `admin/supabase-config.js` and `admin/admin.js`.

`This user is not listed in admin_profiles.`
: Insert a matching `admin_profiles` row for the authenticated user's UUID.

`Save failed. Check Supabase policies and schema.`
: Confirm `supabase/schema.sql` ran successfully and the user's role is `owner` or `editor`.

`Only owners can publish.`
: Change the user's `admin_profiles.role` to `owner` or use an owner account.

Public page does not show published edits.
: Confirm the row in `cms_content` has the exact `page_path`, matching `edit_key`, and `status = 'published'`.

## 10. Local Mock Fallback

Mock login is disabled by default. For local UI testing only, open a page with:

```text
?mockAdmin=true
```

Then use:

- Email: `admin@growva.local`
- Password: `growva-admin`

Do not use mock mode as production authentication.
