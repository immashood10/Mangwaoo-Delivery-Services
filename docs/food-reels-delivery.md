# Food reels and delivery

Website and Expo use the same website APIs, sessions, catalog and Postgres database. The native tabs start with Food, then Shopping, Mart, Reels, Orders and Account. The supplied red M artwork is the launcher icon and native splash image.

## Reels

`/reels` shows approved reels from active accounts. Any signed-in account may submit a food clip, with an optional live food listing. `/reels?mine=1` shows the creator's pending/declined clips and decline reasons. Admin > Food Reels (`/admin/reels`) previews pending clips and approves or declines them. Withdrawing approval immediately hides the public video, comments and ordering endpoint. A creator or admin may delete a reel; its media, likes and comments cascade.

Videos live in a separate `ReelVideo` table so catalog/feed queries never fetch video bytes. Uploads are bounded at 4 MiB on the server, with MP4/WebM signature checks. This leaves safe multipart overhead below Vercel Functions' 4.5 MiB request-body ceiling. The composer limits clips to 60 seconds and offers compressed camera recording. Duration is a browser check; reviewers should also check the submitted video. There are at most three pending clips per creator, five submissions per day, and a transaction-locked 128 MiB total media budget. For a larger public rollout, move video bytes to object storage and transcoding before raising these limits.

Video playback supports a single HTTP byte range and checks moderation/account access before returning bytes. All reel tables have RLS enabled and browser-role grants revoked. Likes are idempotent; comment/like writes lock the approved reel. Approval uses a guarded status update so simultaneous approvals only apply once. Tests stub notifications, WhatsApp, rate limits and sessions, but exercise the actual database operations using disposable fixtures.

The right rail is Like, Comments, Share, Order Now. Local immediate food orders and unlinked custom reels open the customer's managed order Chat with the reel caption and optional restaurant/dish. An address is required. Shipping-only linked dishes offer a link to the listing's checkout, so the vendor receives a real shipping order. Custom unlinked Chat orders remain limited to the Karachi service area.

## Delivery

Listings offer Immediate, 3, 5 or 7 days. Checkout uses the vendor-to-destination distance and snapshots the result on each order. Immediate orders within 10 km in the local service area go through staff dispatch. Scheduled orders use vendor fulfillment. Missing location, distances greater than 10 km, or another city become 5-7 day vendor shipping, including listings originally marked Immediate. A checkout containing several timings from the same vendor uses the longest listed timing for that vendor's order.

Vendor orders store their ETA, city, address and responsible area. The destination's manager is preferred; for remote destinations the vendor's managed area is used. The vendor, its ASM and admins can track fulfillment. Vendors receive customer delivery details only for their own shipping orders. They may update those orders even if immediate orders are normally managed by staff.

Shipping orders never join the rider chat at checkout. Mixed checkouts only put immediate order IDs and their server-generated item summaries in the dispatch chat. Rider assignment also rejects any chat linked to a shipping order. `RiderChat.managerOnly` keeps immediate orders with staff even without an available ASM; admins can assign an eligible rider in Admin > Order Chats. Rider claims atomically require both no area manager and `managerOnly = false`, including when an old access check races with a staff routing change.

## Validation

`test-food-reels.mjs` covers delivery boundaries and listing choices, moderation privacy, video ranges, concurrent approvals and likes, interactions, deletion, RLS, intercity order snapshots and stale rider claims. Run with the project's TypeScript runner and `.env`, with `DATABASE_POOL_MAX=1`. Never enable real notifications in this harness. Temporary users, listings, orders and media are removed in `finally` blocks.

The native history/navigation tests are `node --test mobile/tests/*.test.mjs`. Android testing builds use the existing signing key and `preview` EAS profile, which emits an installable APK. No Expo Go is needed. Updating with the same package/signature preserves the existing app login. Device installation was deferred at the owner's request; browser checks and build checks do not substitute for a new APK's device test.
