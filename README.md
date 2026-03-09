# Solana Token Launchpad Backend (Medium) — Express + Prisma API

## Problem Statement

Build a **database-backed REST API** for a Solana token launchpad platform. Users should be able to:

- Register and log in with email/password (JWT auth).
- Create token launches with optional **tiered pricing** and **vesting schedules**.
- Manage per-launch **whitelists** of wallet addresses.
- Create and manage **referral codes** with discounts and max uses.
- Record **token purchases** with:
  - Tiered pricing by purchase size.
  - Optional referral discounts.
  - Sybil protection via `maxPerWallet` enforced **per user** (across all wallets).
  - Global `totalSupply` cap and duplicate `txSignature` protection.
- Query **vesting schedules** for a wallet based on launch vesting config.

Non-functional requirements:

- Tech stack: **Node.js**, **Express**, **PostgreSQL + Prisma**, **JWT + bcryptjs**.
- Config via `.env`: `DATABASE_URL`, `JWT_SECRET`.
- Server listens on **port 3000**.
- Provide a **Swagger UI** to interactively test the API.

> Note: The backend **does not validate Solana transactions/signatures** on-chain; `txSignature` is stored and enforced as unique only.

## What This Implementation Achieves

### Tech Stack & Project Structure

- **Express** app with TypeScript (`src/index.ts`).
- **Prisma ORM** with PostgreSQL (`prisma/schema.prisma`, `src/prisma.ts`).
- **Authentication** with `jsonwebtoken` + `bcryptjs`.
- **Swagger / OpenAPI 3** docs at `GET /api/docs` (`src/swagger.ts`).
- MVC-style structure:
  - `src/controllers/*` — route handlers (auth, launches, whitelist, referrals, purchases, vesting).
  - `src/middleware/authMiddleware.ts` — `requireAuth`, `attachFullUser`, `AuthRequest`.
  - `src/utils/launchStatus.ts` — computed launch status helpers.

### Data Model (Prisma)

Defined in `prisma/schema.prisma`:

- `User` — registered users with unique `email`.
- `Launch` — token launches with:
  - Core fields: `name`, `symbol`, `totalSupply`, `pricePerToken`, `startsAt`, `endsAt`, `maxPerWallet`, `description?`.
  - Optional vesting config: `cliffDays?`, `vestingDays?`, `tgePercent?`.
  - Relation to `creator` (`User`).
- `LaunchTier` — optional tiered pricing per launch (`minAmount`, `maxAmount`, `pricePerToken`).
- `WhitelistEntry` — per-launch whitelisted `address`, unique on `[launchId, address]`.
- `ReferralCode` — per-launch referral codes with `code`, `discountPercent`, `maxUses`, `usedCount`, unique on `[launchId, code]`.
- `Purchase` — recorded purchases per user and wallet, with unique `txSignature` and stored `totalCost`.

### Authentication

Routes:

- `POST /api/auth/register`
  - Body: `{ email, password, name }`
  - Validates required fields; rejects duplicate email (`409`).
  - Creates user with hashed password.
  - Returns `{ token, user: { id, email, name } }` (`201`).
- `POST /api/auth/login`
  - Body: `{ email, password }`
  - Validates credentials; returns `{ token, user }` (`200`) or `401`.

JWT handling:

- `requireAuth` middleware:
  - Reads `Authorization: Bearer <token>`.
  - Verifies JWT signature and expiry using `JWT_SECRET`.
  - Extracts `userId` and attaches `req.user`.
- `attachFullUser` middleware:
  - Loads full user from DB (`prisma.user`) and re-attaches `email`, `name`.

All non-public routes require valid JWT; missing/invalid token → `401`.

### Launches & Status

Routes:

- `POST /api/launches` (auth, creator)
- `GET /api/launches` (public; pagination + optional `status` filter)
- `GET /api/launches/:id` (public)
- `PUT /api/launches/:id` (auth, creator-only)

Business logic:

- Launch objects always include a **computed `status`** using:
  - `SOLD_OUT` — `totalPurchased >= totalSupply`.
  - `UPCOMING` — `now < startsAt`.
  - `ENDED` — `now > endsAt`.
  - `ACTIVE` — otherwise (between `startsAt` and `endsAt`, not sold out).
- `GET /api/launches` supports `?page=&limit=&status=`; filters by computed status.

### Whitelist Management (Creator Only)

Routes:

- `POST /api/launches/:id/whitelist`
  - Body: `{ addresses: string[] }`.
  - Adds unique addresses via `createMany` with `skipDuplicates`.
  - Returns `{ added, total }`.
- `GET /api/launches/:id/whitelist`
  - Returns `{ addresses, total }`.
- `DELETE /api/launches/:id/whitelist/:address`
  - Returns `{ removed: true }` or `404`.

All whitelist routes:

- Require JWT.
- Enforce `launch.creatorId === req.user.id` → `403` for non-creators.

### Referral Codes (Creator Only)

Routes:

- `POST /api/launches/:id/referrals`
  - Body: `{ code, discountPercent, maxUses }`.
  - Enforces unique `code` per launch; duplicate → `409`.
  - Returns `{ id, code, discountPercent, maxUses, usedCount: 0 }` (`201`).
- `GET /api/launches/:id/referrals`
  - Returns list of referral codes including `usedCount`.

Both routes:

- Require JWT and that caller is **launch creator**.

### Token Purchases (Auth Required)

Routes:

- `POST /api/launches/:id/purchase`
  - Body: `{ walletAddress, amount, txSignature, referralCode? }`.
  - Validations:
    - Launch exists; otherwise `404`.
    - Launch computed status must be `ACTIVE`; otherwise `400`.
    - If whitelist exists, wallet must be whitelisted; otherwise `400`.
    - `maxPerWallet` enforced **per user** (sum of all their purchases for the launch); exceed → `400`.
    - Global `totalSupply` cap enforced; exceed → `400`.
    - `txSignature` unique; duplicate → `400`.
  - Pricing:
    - If tiers exist: fills tiers in ascending `minAmount`, capacity `maxAmount - minAmount`; overflow uses base `pricePerToken`.
    - Else: flat pricing `amount * pricePerToken`.
  - Referral:
    - If `referralCode` provided:
      - Validates existence and available `maxUses`.
      - Applies `discountPercent` to computed `totalCost`.
      - Increments `usedCount` atomically in the transaction.
      - Invalid or exhausted code → `400`.
  - Returns created purchase (including `userId`, `walletAddress`, `amount`, `totalCost`, `txSignature`).

- `GET /api/launches/:id/purchases`
  - If caller is **creator**: returns **all** purchases for the launch.
  - Otherwise: returns **only purchases for the calling user**.
  - Always includes `userId` in each purchase for ownership checks.

### Vesting Schedule

Route:

- `GET /api/launches/:id/vesting?walletAddress=ADDR`
  - Requires JWT.
  - Without vesting config: all tokens are immediately claimable.
  - With vesting:
    - `tgeAmount = floor(totalPurchased * tgePercent / 100)`.
    - `cliffEndsAt = startsAt + cliffDays`.
    - After cliff: remaining tokens vest **linearly** over `vestingDays`.
  - Returns:
    - `{ totalPurchased, tgeAmount, cliffEndsAt, vestedAmount, lockedAmount, claimableAmount }`.
  - `400` for missing `walletAddress`, `404` for missing launch.

### Swagger / API Testing

- Swagger UI mounted at: `GET /api/docs`.
- Includes endpoints for:
  - Health, auth, launches, whitelist, referrals, purchases, vesting.
- JWT security scheme (`bearerAuth`) wired so you can authorize once and test protected routes.

### Running the Project

1. Ensure `.env` is filled:

```bash
DATABASE_URL="postgresql://user:password@localhost:5432/launchpad"
JWT_SECRET="your_jwt_secret"
```

2. Install dependencies and generate Prisma client:

```bash
npm install
npx prisma generate
npx prisma db push
```

3. Start the server:

```bash
npm start
```

4. Open in browser:

- Health: `http://localhost:3000/api/health`
- Swagger UI: `http://localhost:3000/api/docs`

