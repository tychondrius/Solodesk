# SoloDesk Firestore Security Specification (Phase 0 TDD)

## 1. Data Invariants

1. **Default-Deny Catch-All**: No read or write is permitted on any path unless explicitly matched and authorized.
2. **Verified Tenant Isolation (1:1 Sole-Trader Ownership)**:
   - Every user owns a single workspace where `businessId == request.auth.uid` and `ownerId == request.auth.uid`.
   - All writes require `request.auth != null && request.auth.token.email_verified == true`.
   - Every `get`, `list`, `create`, `update`, and `delete` operation strictly enforces `ownerId == request.auth.uid` (or `userId == request.auth.uid` on `/users/{userId}`).
3. **PII Isolation**:
   - `/users/{userId}` and `/customers/{customerId}` contain private PII (`email`, `phone`, `address`). Blanket `isSignedIn()` reads are strictly prohibited; only the verified owner (`request.auth.uid`) may read or list their own documents.
4. **Relational & Atomic Batch Integrity**:
   - No `Customer`, `Order`, `Payment`, `Expense`, `Task`, or `Notification` can be created unless `/businesses/$(request.auth.uid)` exists and is owned by `request.auth.uid`.
   - Creating an `Order` requires `getAfter(/databases/$(database)/documents/customers/$(incoming().customerId)).data.ownerId == request.auth.uid` (supporting both existing customers and atomic customer+order batch creation).
   - Creating a `Payment` requires `getAfter(/databases/$(database)/documents/orders/$(incoming().orderId)).data.ownerId == request.auth.uid` and `status != 'Cancelled'`.
5. **Anti-Update-Gap, Financial Balance & Audit Ledger Invariants**:
   - Every `create` and `update` executes `isValid[Entity](incoming())` checking `keys().hasAll(...)`, `keys().hasOnly(...)`, strict types, regex ID patterns, and `.size()` bounds.
   - `isValidOrder` enforces `amountPaid <= totalPrice` and `|(totalPrice - amountPaid) - remainingBalance| < 0.01`, preventing overpayments or corrupted balances.
   - Paid orders (`existing().amountPaid > 0`) cannot be permanently deleted (`allow delete` requires `existing().amountPaid == 0`); users archive paid orders instead so historical revenue remains intact.
   - Recorded `Payment` ledger entries cannot be deleted (`allow delete: if false;`).
   - Every `update` explicitly enforces `affectedKeys().hasOnly(...)`, immutable `id`, `ownerId`, `businessId`, and `createdAt`, plus `updatedAt == request.time`.
6. **Terminal State Locking**:
   - Once an `Order` reaches terminal `status == 'Cancelled'`, subsequent `update` operations and new `Payment` creations on that document are denied.

## 2. The "Dirty Dozen" Adversarial Payloads

1. **Unverified Email Write**: Authenticated user with `email_verified: false` attempts `create` on `/businesses/userA` -> `PERMISSION_DENIED`.
2. **Cross-Tenant Identity Spoofing**: `userA` attempts `create` on `/orders/ord_1` with `ownerId: "userB"` -> `PERMISSION_DENIED`.
3. **Shadow / Ghost Field Injection**: `userA` updates `/orders/ord_1` adding `"isSuperAdmin": true` -> `PERMISSION_DENIED` (`hasOnly` rejection).
4. **PII Blanket Read**: `userB` attempts `get` on `/customers/cust_owned_by_userA` -> `PERMISSION_DENIED`.
5. **Unfiltered List Scraping**: `userB` runs `list` on `/orders` without `where('ownerId', '==', 'userB')` -> `PERMISSION_DENIED` (`resource.data.ownerId == request.auth.uid`).
6. **ID Poisoning Attack**: `userA` attempts `create` on `/customers/bad$id/with spaces!` or 500-char ID -> `PERMISSION_DENIED` (`isValidId` guard).
7. **Denial-of-Wallet String Bloat**: `userA` sends a 50,000-char string in `Order.description` -> `PERMISSION_DENIED` (`maxLength: 2000` check).
8. **Orphaned Order Without Customer**: `userA` creates an `Order` referencing non-existent `customerId: "ghost_cust"` -> `PERMISSION_DENIED` (`exists` relational check).
9. **Immutable Owner Mutation**: `userA` updates an existing `Customer` changing `ownerId` to `"userB"` -> `PERMISSION_DENIED`.
10. **Client-Spoofed Timestamp**: `userA` creates an `Expense` with `createdAt` set to a past timestamp instead of `request.time` -> `PERMISSION_DENIED`.
11. **Terminal State Resurrection**: `userA` attempts `update` on an `Order` whose `existing().status == 'Cancelled'` -> `PERMISSION_DENIED`.
12. **Value Type Poisoning**: `userA` updates whitelisted key `amountPaid` on `/orders/ord_1` with string `"100"` or negative `-50` -> `PERMISSION_DENIED` (`isValidOrder` wrapper blocks invalid type/range).

## 3. Test Suite Reference
Verified in `src/security/firestore.rules.test.ts` via `npx --yes tsx --test src/security/firestore.rules.test.ts`.
