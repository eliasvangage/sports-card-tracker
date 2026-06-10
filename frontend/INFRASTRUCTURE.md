# CardRoster Infrastructure

CardRoster should move from local browser storage to account-owned data in this order:

1. Auth: Clerk.
2. Database: Postgres with Prisma.
3. Image storage: UploadThing or Supabase Storage.
4. Card ownership: every card belongs to a user, and optionally to a collection.
5. Privacy: cards and collections stay private until the collector marks them public.
6. Social layer: follows, likes, comments, public profiles, public vaults.
7. Coordination layer: sale links, trade links, messages or external contact links. Deals should happen off-platform.
8. Safety: image moderation before public posting, reporting, hidden comments/cards, and an admin review queue.
9. Portability: CSV export, spreadsheet import, and account data backup.
10. Collector workflows: grading queue, storage location, cert lookup, price lookup, and trade matching.

Recommended first implementation:

```bash
npm install prisma @prisma/client @clerk/nextjs uploadthing zod @upstash/ratelimit @upstash/redis svix
npx prisma generate
npx prisma migrate dev --name init
```

## Priority 1: Auth and Owned Data

The localStorage prototype is useful for UI iteration, but the production product starts when every card belongs to an authenticated user in Postgres.

- Clerk should protect every private route.
- Clerk webhooks should create and update `User` and `Profile` rows.
- All API routes must scope reads and writes by the authenticated internal `User.id`.
- Do not trust client-sent card, collection, or profile IDs without an ownership check.
- Public profile/card routes should only return records marked `public: true`.

The first real account feature should be profile ownership:

- `/profile` edits the signed-in user's profile.
- `/u/[handle]` shows the public profile.
- `/u/[handle]/collections/[collectionId]` shows one public vault.
- cards uploaded through `/upload` are saved to storage and inserted into `Card`.
- feed actions create `Like`, `Comment`, `Follow`, and `WishlistItem` rows.
- saving another collector's card to a wishlist should not duplicate it into inventory unless the user later marks it acquired.
- public activity should be written to `FeedEvent`, then read back as the social feed instead of rebuilding the feed from every table on every request.
- CSV import/export should be first-class. Users do not trust collection apps that trap their data.
- price estimates should store source and confidence, not just a single number.
- grading workflows should store grading company, cert number, grading fee, all-in cost, estimated grade, and result grade.

## Priority 2: Image Storage

UploadThing is the simplest fit for the current Next.js stack. Card images can be public CDN URLs, but private verification assets should use signed time-limited URLs.

- Replace base64 localStorage image data with UploadThing URLs.
- Store card fronts in `Card.imageUrl`.
- Store card backs in `Card.backImageUrl`.
- Keep crop data in Postgres: `imageX`, `imageY`, `imageZoom`, and `imageRotation`.
- Run image moderation before making a card or profile public.

## Priority 3: API Security

- Add Zod schemas for every create/update route.
- Add rate limiting to auth, upload, import, feed, like, comment, follow, and trade-interest routes.
- Keep all secrets server-only unless they intentionally use a `NEXT_PUBLIC_` prefix.
- Avoid raw SQL; if needed, use Prisma tagged SQL, not string interpolation.
- Treat reports as first-class moderation data for cards, comments, and users.

## Priority 4: Social Routes

These routes make CardRoster feel like a public collector platform instead of only an inventory app:

- `/u/[handle]`: public collector profile.
- `/u/[handle]/vaults/[slug]`: public collection page.
- `/u/[handle]/cards/[cardId]`: shareable card page with Open Graph image.
- `/feed`: authenticated feed of followed collectors and public activity.
- `/trade`: public cards marked for trade, searchable by player, team, year, and set.
- `/api/cards`: authenticated card CRUD.
- `/api/follow/[userId]`: follow and unfollow.
- `/api/cards/[id]/like`: like and unlike.
- `/api/cards/[id]/trade-interest`: coordinate interest without handling payments.

The current localStorage app can stay as a prototype layer while database-backed routes are added one screen at a time.
