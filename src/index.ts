import express, { Request, Response } from "express";

import { prisma } from "./prisma";
import {
  AuthRequest,
  attachFullUser,
  requireAuth,
} from "./middleware/authMiddleware";
import { register, login } from "./controllers/authController";
import {
  createLaunch,
  getLaunch,
  listLaunches,
  updateLaunch,
} from "./controllers/launchController";
import {
  addToWhitelist,
  getWhitelist,
  removeFromWhitelist,
} from "./controllers/whitelistController";
import {
  createReferral,
  listReferrals,
} from "./controllers/referralController";
import {
  createPurchase,
  listPurchases,
} from "./controllers/purchaseController";
import { getVesting } from "./controllers/vestingController";
import { setupSwagger } from "./swagger";

const app = express();
app.use(express.json());

// Swagger / OpenAPI setup in separate module
setupSwagger(app);

// Health check (public)
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

// Authentication
app.post("/api/auth/register", register);
app.post("/api/auth/login", login);

// Create launch (auth required)
app.post("/api/launches", requireAuth, attachFullUser, createLaunch);

// List launches (public, with optional status filter)
app.get("/api/launches", listLaunches);

// Get single launch (public)
app.get("/api/launches/:id", getLaunch);

// Update launch (auth, creator only)
app.put("/api/launches/:id", requireAuth, attachFullUser, updateLaunch);

// Whitelist management (auth, creator only)
app.post(
  "/api/launches/:id/whitelist",
  requireAuth,
  attachFullUser,
  addToWhitelist,
);

app.get(
  "/api/launches/:id/whitelist",
  requireAuth,
  attachFullUser,
  getWhitelist,
);

app.delete(
  "/api/launches/:id/whitelist/:address",
  requireAuth,
  attachFullUser,
  removeFromWhitelist,
);

// Referral codes (auth, creator only)
app.post(
  "/api/launches/:id/referrals",
  requireAuth,
  attachFullUser,
  createReferral,
);

app.get(
  "/api/launches/:id/referrals",
  requireAuth,
  attachFullUser,
  listReferrals,
);

app.post(
  "/api/launches/:id/purchase",
  requireAuth,
  attachFullUser,
  createPurchase,
);

// Get purchases for a launch
app.get(
  "/api/launches/:id/purchases",
  requireAuth,
  attachFullUser,
  listPurchases,
);

// Vesting schedule
app.get("/api/launches/:id/vesting", requireAuth, getVesting);

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
