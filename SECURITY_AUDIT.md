# Multi-User Isolation Security Audit

Date: 2026-02-12

## Tables Reviewed
- `profiles`
- `daily_logs`
- `user_goals`
- `drinking_events`
- `feed_items`
- `follows`
- `likes`
- `comments`

## RLS Status (Current + Post-Fix)
- `profiles`
  - RLS: enabled
  - Policies: public read for `is_public = true` or owner; owner-only insert/update
  - Risk: public select exposed `email` column (fixed via column privilege revoke)
- `daily_logs`
  - RLS: enabled
  - Policies: owner-only select/insert/update/delete
  - Fix: add `WITH CHECK` to update policy to prevent ownership reassignment
- `user_goals`
  - RLS: enabled
  - Policies: owner-only select/insert/update
  - Fix: add `WITH CHECK` to update policy to prevent ownership reassignment
- `drinking_events`
  - RLS: enabled
  - Policies: owner-only select/insert/update/delete
  - Fix: add `WITH CHECK` to update policy to prevent ownership reassignment
- `feed_items`
  - RLS: enabled
  - Policies: owner all-access + public select based on profile visibility + per-event show flags
- `follows`
  - RLS: enabled
  - Policies: readable by follower/following, or by public profile; insert/delete by follower
- `likes`
  - RLS: enabled
  - Policies: readable only for visible feed items; insert/delete by owner
  - Fix: insert now requires feed item visibility (prevents liking private items)
- `comments`
  - RLS: enabled
  - Policies: select/insert/delete
  - Fix: select restricted to visible feed items; insert restricted to visible feed items + author ownership

## Code Paths Reviewed (Supabase Reads/Writes)
- Dashboard: `app/page.tsx`
- Logs: `app/logs/page.tsx`, `app/components/DailyLog.tsx`
- Goals/Onboarding: `app/goals/page.tsx`, `app/onboarding/OnboardingClient.tsx`, `app/settings/page.tsx`
- Social + Profile: `lib/social.ts`, `lib/profile.ts`, `app/u/[username]/page.tsx`, `app/components/profile/ProfileView.tsx`
- Drinking: `lib/drinking.ts`
- Auth/session: `lib/supabase.ts`, `app/components/useSession.tsx`

## Findings (Before Fixes)

### Critical
1) **Comments readable by all authenticated users**
   - Cause: `20260211_fix_comments_schema.sql` replaced visibility-aware policy with `authenticated can select all`.
   - Impact: any authenticated user could read comments for private feed items (cross-user data exposure).

### High
2) **Profile `email` column exposed by public read policy**
   - Cause: `profiles` table allows public read for `is_public = true`; `email` column remains selectable.
   - Impact: public users could fetch email addresses for public profiles.

3) **Update policies missing `WITH CHECK` (ownership reassignment)**
   - Tables: `daily_logs`, `user_goals`, `drinking_events`, `profiles`
   - Impact: a user could update their row and change `user_id`/`id` to another value, enabling cross-user writes.

### Medium
4) **Likes insert policy did not validate feed item visibility**
   - Impact: users could like private feed items if they could guess the id.

### Low
5) **Follows readable for public profiles**
   - Intentional; verify this is acceptable as a product decision.

## Fixes Applied
**SQL migration:** `supabase/migrations/20260212_security_hardening.sql`

- Revoke `profiles.email` select from `anon` and `authenticated`.
- Add `WITH CHECK` to update policies for `profiles`, `user_goals`, `daily_logs`, `drinking_events`.
- Replace comments policies with visibility-aware select/insert (owner or public feed item with event visibility).
- Tighten likes insert policy to require feed item visibility.

## How To Verify (Two-User Isolation Checklist)

### Setup
1. Create two users: User A and User B.
2. Set User A profile `is_public = false`, User B `is_public = true`.

### Read isolation
1. As User A, create:
   - goals, daily log, drinking event
   - a private feed item (workout/reading/drinking)
2. As User B, verify:
   - `daily_logs` and `user_goals` for User A are not visible.
   - `feed_items` for User A are not visible when `is_public = false`.
   - `comments` on User A’s private feed items are not readable.

### Write isolation
1. As User B, attempt to:
   - update User A’s `daily_logs` or `user_goals` via a manual REST call
   - like/comment on User A’s private feed item (known id)
2. Confirm all are denied by RLS.

### Public visibility
1. As User B, confirm public profiles can be read:
   - `profiles.username`, `display_name`, `profile_photo_url`
2. Confirm `profiles.email` is NOT readable.

### Application flows
1. Social feed shows only public items or own items.
2. Comment counts and lists are scoped to visible feed items only.
3. Goal edits and log writes only affect current user.

## Remaining Risks / Assumptions
- `profiles` public read is intentional and limited to safe columns (email now restricted via column privilege).
- Social visibility rules depend on profile `is_public` and per-category `show_*` flags.
- If new tables are added, ensure RLS + policies are added immediately.
