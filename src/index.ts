import express, { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { PrismaClient, Prisma } from "@prisma/client";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

const app = express();
app.use(express.json());

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET must be defined in environment");
}

// Swagger / OpenAPI setup
const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "Solana Token Launchpad API",
      version: "1.0.0",
      description: "REST API for Solana token launchpad backend",
    },
    servers: [{ url: "http://localhost:3000" }],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            id: { type: "string" },
            email: { type: "string" },
            name: { type: "string" },
          },
        },
        Launch: {
          type: "object",
          properties: {
            id: { type: "string" },
            name: { type: "string" },
            symbol: { type: "string" },
            totalSupply: { type: "integer" },
            pricePerToken: { type: "string" },
            startsAt: { type: "string", format: "date-time" },
            endsAt: { type: "string", format: "date-time" },
            maxPerWallet: { type: "integer" },
            description: { type: "string", nullable: true },
            status: { type: "string" },
          },
        },
        Purchase: {
          type: "object",
          properties: {
            id: { type: "string" },
            userId: { type: "string" },
            walletAddress: { type: "string" },
            amount: { type: "integer" },
            totalCost: { type: "string" },
            txSignature: { type: "string" },
            createdAt: { type: "string", format: "date-time" },
          },
        },
        Referral: {
          type: "object",
          properties: {
            id: { type: "string" },
            code: { type: "string" },
            discountPercent: { type: "integer" },
            maxUses: { type: "integer" },
            usedCount: { type: "integer" },
          },
        },
        Vesting: {
          type: "object",
          properties: {
            totalPurchased: { type: "integer" },
            tgeAmount: { type: "integer" },
            cliffEndsAt: { type: "string", format: "date-time", nullable: true },
            vestedAmount: { type: "integer" },
            lockedAmount: { type: "integer" },
            claimableAmount: { type: "integer" },
          },
        },
      },
    },
    security: [{ bearerAuth: [] }],
    paths: {
      "/api/health": {
        get: {
          summary: "Health check",
          responses: {
            200: {
              description: "OK",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: { status: { type: "string" } },
                  },
                },
              },
            },
          },
        },
      },
      "/api/auth/register": {
        post: {
          summary: "Register a new user",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password", "name"],
                  properties: {
                    email: { type: "string" },
                    password: { type: "string" },
                    name: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: "User registered",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      token: { type: "string" },
                      user: { $ref: "#/components/schemas/User" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/auth/login": {
        post: {
          summary: "Login",
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["email", "password"],
                  properties: {
                    email: { type: "string" },
                    password: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Logged in",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      token: { type: "string" },
                      user: { $ref: "#/components/schemas/User" },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/launches": {
        get: {
          summary: "List token launches",
          parameters: [
            {
              name: "page",
              in: "query",
              schema: { type: "integer", default: 1 },
            },
            {
              name: "limit",
              in: "query",
              schema: { type: "integer", default: 10 },
            },
            {
              name: "status",
              in: "query",
              schema: {
                type: "string",
                enum: ["SOLD_OUT", "UPCOMING", "ENDED", "ACTIVE"],
              },
            },
          ],
          responses: {
            200: {
              description: "List of launches",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      launches: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Launch" },
                      },
                      total: { type: "integer" },
                      page: { type: "integer" },
                      limit: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          summary: "Create a launch",
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: [
                    "name",
                    "symbol",
                    "totalSupply",
                    "pricePerToken",
                    "startsAt",
                    "endsAt",
                    "maxPerWallet",
                  ],
                  properties: {
                    name: { type: "string" },
                    symbol: { type: "string" },
                    totalSupply: { type: "integer" },
                    pricePerToken: { type: "number" },
                    startsAt: { type: "string", format: "date-time" },
                    endsAt: { type: "string", format: "date-time" },
                    maxPerWallet: { type: "integer" },
                    description: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: "Launch created",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Launch" },
                },
              },
            },
          },
        },
      },
      "/api/launches/{id}": {
        get: {
          summary: "Get launch by id",
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Launch",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Launch" },
                },
              },
            },
            404: { description: "Launch not found" },
          },
        },
      },
      "/api/launches/{id}/purchase": {
        post: {
          summary: "Purchase tokens in a launch",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["walletAddress", "amount", "txSignature"],
                  properties: {
                    walletAddress: { type: "string" },
                    amount: { type: "integer" },
                    txSignature: { type: "string" },
                    referralCode: { type: "string" },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: "Purchase recorded",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Purchase" },
                },
              },
            },
          },
        },
      },
      "/api/launches/{id}/whitelist": {
        post: {
          summary: "Add addresses to whitelist",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["addresses"],
                  properties: {
                    addresses: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                },
              },
            },
          },
          responses: {
            200: {
              description: "Whitelist updated",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      added: { type: "integer" },
                      total: { type: "integer" },
                    },
                  },
                },
              },
            },
          },
        },
        get: {
          summary: "Get whitelist addresses",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Whitelist addresses",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      addresses: {
                        type: "array",
                        items: { type: "string" },
                      },
                      total: { type: "integer" },
                    },
                  },
                },
              },
            },
            403: { description: "Forbidden (not creator)" },
          },
        },
      },
      "/api/launches/{id}/whitelist/{address}": {
        delete: {
          summary: "Remove an address from whitelist",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "address",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Address removed",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      removed: { type: "boolean" },
                    },
                  },
                },
              },
            },
            404: { description: "Address not found" },
          },
        },
      },
      "/api/launches/{id}/referrals": {
        post: {
          summary: "Create referral code",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          requestBody: {
            required: true,
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  required: ["code", "discountPercent", "maxUses"],
                  properties: {
                    code: { type: "string" },
                    discountPercent: { type: "integer" },
                    maxUses: { type: "integer" },
                  },
                },
              },
            },
          },
          responses: {
            201: {
              description: "Referral created",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Referral" },
                },
              },
            },
            409: { description: "Duplicate code for this launch" },
          },
        },
        get: {
          summary: "List referral codes",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "List of referral codes",
              content: {
                "application/json": {
                  schema: {
                    type: "array",
                    items: { $ref: "#/components/schemas/Referral" },
                  },
                },
              },
            },
          },
        },
      },
      "/api/launches/{id}/purchases": {
        get: {
          summary: "List purchases for launch",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Purchases list",
              content: {
                "application/json": {
                  schema: {
                    type: "object",
                    properties: {
                      purchases: {
                        type: "array",
                        items: { $ref: "#/components/schemas/Purchase" },
                      },
                      total: { type: "integer" },
                    },
                  },
                },
              },
            },
            401: { description: "Unauthorized" },
          },
        },
      },
      "/api/launches/{id}/vesting": {
        get: {
          summary: "Get vesting schedule for wallet",
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            {
              name: "walletAddress",
              in: "query",
              required: true,
              schema: { type: "string" },
            },
          ],
          responses: {
            200: {
              description: "Vesting info",
              content: {
                "application/json": {
                  schema: { $ref: "#/components/schemas/Vesting" },
                },
              },
            },
            400: { description: "Missing walletAddress" },
            404: { description: "Launch not found" },
          },
        },
      },
    },
  },
  apis: [],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

type AuthUser = {
  id: string;
  email: string;
  name: string;
};

interface AuthRequest extends Request {
  user?: AuthUser;
}

type LaunchStatus = "SOLD_OUT" | "UPCOMING" | "ENDED" | "ACTIVE";

function computeLaunchStatus(opts: {
  startsAt: Date;
  endsAt: Date;
  totalSupply: number;
  totalPurchased: number;
}): LaunchStatus {
  const now = new Date();

  if (opts.totalPurchased >= opts.totalSupply) {
    return "SOLD_OUT";
  }
  if (now < opts.startsAt) {
    return "UPCOMING";
  }
  if (now > opts.endsAt) {
    return "ENDED";
  }
  return "ACTIVE";
}

function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.header("Authorization");
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const token = authHeader.slice("Bearer ".length);
  try {
    const decoded = jwt.verify(token, JWT_SECRET as string) as JwtPayload & {
      userId: string;
    };
    if (!decoded.userId) {
      return res.status(401).json({ error: "Invalid token" });
    }

    // We only know user id here; fetch user lazily when needed if more fields required
    req.user = { id: decoded.userId, email: "", name: "" };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

async function attachFullUser(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
    });
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    req.user = { id: user.id, email: user.email, name: user.name };
    next();
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

// Health check (public)
app.get("/api/health", (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

// Authentication
app.post("/api/auth/register", async (req: Request, res: Response) => {
  try {
    const { email, password, name } = req.body ?? {};
    if (!email || !password || !name) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: "Email already in use" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email, passwordHash, name },
    });

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(201).json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.post("/api/auth/login", async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.status(200).json({
      token,
      user: { id: user.id, email: user.email, name: user.name },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Helper to format launch with computed status
async function buildLaunchResponse(launchId: string) {
  const launch = await prisma.launch.findUnique({
    where: { id: launchId },
    include: {
      purchases: { select: { amount: true } },
      tiers: true,
    },
  });
  if (!launch) return null;

  const totalPurchased =
    launch.purchases.reduce(
      (sum: any, p: { amount: any }) => sum + p.amount,
      0,
    ) ?? 0;
  const status = computeLaunchStatus({
    startsAt: launch.startsAt,
    endsAt: launch.endsAt,
    totalSupply: launch.totalSupply,
    totalPurchased,
  });

  // Strip purchases from response but keep tiers
  const { purchases, ...rest } = launch;
  return { ...rest, status, totalPurchased };
}

// Create launch (auth required)
app.post(
  "/api/launches",
  requireAuth,
  (req: AuthRequest, res: Response, next: NextFunction) =>
    attachFullUser(req, res, next),
  async (req: AuthRequest, res: Response) => {
    try {
      const {
        name,
        symbol,
        totalSupply,
        pricePerToken,
        startsAt,
        endsAt,
        maxPerWallet,
        description,
        tiers,
        vesting,
      } = req.body ?? {};

      if (
        !name ||
        !symbol ||
        totalSupply == null ||
        pricePerToken == null ||
        !startsAt ||
        !endsAt ||
        maxPerWallet == null
      ) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const creatorId = req.user!.id;

      const data: Prisma.LaunchCreateInput = {
        name,
        symbol,
        totalSupply: Number(totalSupply),
        pricePerToken: new Prisma.Decimal(pricePerToken),
        startsAt: new Date(startsAt),
        endsAt: new Date(endsAt),
        maxPerWallet: Number(maxPerWallet),
        description: description ?? null,
        creator: { connect: { id: creatorId } },
      };

      if (vesting) {
        if (
          vesting.cliffDays == null ||
          vesting.vestingDays == null ||
          vesting.tgePercent == null
        ) {
          return res
            .status(400)
            .json({ error: "Incomplete vesting configuration" });
        }
        (data as any).cliffDays = Number(vesting.cliffDays);
        (data as any).vestingDays = Number(vesting.vestingDays);
        (data as any).tgePercent = Number(vesting.tgePercent);
      }

      if (Array.isArray(tiers) && tiers.length > 0) {
        (data as any).tiers = {
          create: tiers.map((t: any) => ({
            minAmount: Number(t.minAmount),
            maxAmount: Number(t.maxAmount),
            pricePerToken: new Prisma.Decimal(t.pricePerToken),
          })),
        };
      }

      const launch = await prisma.launch.create({ data });

      const launchWithStatus = await buildLaunchResponse(launch.id);
      res.status(201).json(launchWithStatus);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// List launches (public, with optional status filter)
app.get("/api/launches", async (req: Request, res: Response) => {
  try {
    const {
      page = "1",
      limit = "10",
      status,
    } = req.query as {
      page?: string;
      limit?: string;
      status?: string;
    };
    const pageNum = Math.max(1, parseInt(page || "1", 10) || 1);
    const pageSize = Math.max(
      1,
      Math.min(100, parseInt(limit || "10", 10) || 10),
    );

    const statusFilter = status as LaunchStatus | undefined;

    if (statusFilter) {
      const launches = await prisma.launch.findMany({
        include: {
          purchases: { select: { amount: true } },
          tiers: true,
        },
        orderBy: { createdAt: "desc" },
      });

      const enriched = launches.map(
        (launch: {
          [x: string]: any;
          purchases: any;
          startsAt?: any;
          endsAt?: any;
          totalSupply?: any;
        }) => {
          const totalPurchased =
            launch.purchases.reduce(
              (sum: any, p: { amount: any }) => sum + p.amount,
              0,
            ) ?? 0;
          const computedStatus = computeLaunchStatus({
            startsAt: launch.startsAt,
            endsAt: launch.endsAt,
            totalSupply: launch.totalSupply,
            totalPurchased,
          });
          const { purchases, ...rest } = launch;
          return { ...rest, status: computedStatus, totalPurchased };
        },
      );

      const filtered = enriched.filter(
        (l: { status: string }) => l.status === statusFilter,
      );
      const total = filtered.length;
      const start = (pageNum - 1) * pageSize;
      const paginated = filtered.slice(start, start + pageSize);

      return res.status(200).json({
        launches: paginated,
        total,
        page: pageNum,
        limit: pageSize,
      });
    }

    const [launches, total] = await Promise.all([
      prisma.launch.findMany({
        skip: (pageNum - 1) * pageSize,
        take: pageSize,
        include: {
          purchases: { select: { amount: true } },
          tiers: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      prisma.launch.count(),
    ]);

    const enriched = launches.map(
      (launch: {
        [x: string]: any;
        purchases: any;
        startsAt?: any;
        endsAt?: any;
        totalSupply?: any;
      }) => {
        const totalPurchased =
          launch.purchases.reduce(
            (sum: any, p: { amount: any }) => sum + p.amount,
            0,
          ) ?? 0;
        const statusComputed = computeLaunchStatus({
          startsAt: launch.startsAt,
          endsAt: launch.endsAt,
          totalSupply: launch.totalSupply,
          totalPurchased,
        });
        const { purchases, ...rest } = launch;
        return { ...rest, status: statusComputed, totalPurchased };
      },
    );

    res.status(200).json({
      launches: enriched,
      total,
      page: pageNum,
      limit: pageSize,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get single launch (public)
app.get("/api/launches/:id", async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const launchWithStatus = await buildLaunchResponse(id);
    if (!launchWithStatus) {
      return res.status(404).json({ error: "Launch not found" });
    }
    res.status(200).json(launchWithStatus);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update launch (auth, creator only)
app.put(
  "/api/launches/:id",
  requireAuth,
  (req: AuthRequest, res: Response, next: NextFunction) =>
    attachFullUser(req, res, next),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const launch = await prisma.launch.findUnique({ where: { id } });
      if (!launch) {
        return res.status(404).json({ error: "Launch not found" });
      }
      if (launch.creatorId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const {
        name,
        symbol,
        totalSupply,
        pricePerToken,
        startsAt,
        endsAt,
        maxPerWallet,
        description,
      } = req.body ?? {};

      const data: Prisma.LaunchUpdateInput = {};
      if (name !== undefined) data.name = name;
      if (symbol !== undefined) data.symbol = symbol;
      if (totalSupply !== undefined) data.totalSupply = Number(totalSupply);
      if (pricePerToken !== undefined)
        data.pricePerToken = new Prisma.Decimal(pricePerToken);
      if (startsAt !== undefined) data.startsAt = new Date(startsAt);
      if (endsAt !== undefined) data.endsAt = new Date(endsAt);
      if (maxPerWallet !== undefined) data.maxPerWallet = Number(maxPerWallet);
      if (description !== undefined) data.description = description;

      const updated = await prisma.launch.update({
        where: { id },
        data,
      });

      const launchWithStatus = await buildLaunchResponse(updated.id);
      res.status(200).json(launchWithStatus);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// Whitelist management (auth, creator only)
app.post(
  "/api/launches/:id/whitelist",
  requireAuth,
  (req: AuthRequest, res: Response, next: NextFunction) =>
    attachFullUser(req, res, next),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { addresses } = req.body ?? {};
      if (!Array.isArray(addresses) || addresses.length === 0) {
        return res
          .status(400)
          .json({ error: "addresses must be a non-empty array" });
      }

      const launch = await prisma.launch.findUnique({ where: { id } });
      if (!launch) {
        return res.status(404).json({ error: "Launch not found" });
      }
      if (launch.creatorId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const uniqueAddresses = Array.from(
        new Set(addresses.map((a: string) => a.trim()).filter(Boolean)),
      );

      const result = await prisma.whitelistEntry.createMany({
        data: uniqueAddresses.map((address: string) => ({
          launchId: id,
          address,
        })),
        skipDuplicates: true,
      });

      const total = await prisma.whitelistEntry.count({
        where: { launchId: id },
      });

      res.status(200).json({ added: result.count, total });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

app.get(
  "/api/launches/:id/whitelist",
  requireAuth,
  (req: AuthRequest, res: Response, next: NextFunction) =>
    attachFullUser(req, res, next),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const launch = await prisma.launch.findUnique({ where: { id } });
      if (!launch) {
        return res.status(404).json({ error: "Launch not found" });
      }
      if (launch.creatorId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const entries = await prisma.whitelistEntry.findMany({
        where: { launchId: id },
        select: { address: true },
      });

      res.status(200).json({
        addresses: entries.map((e: { address: any }) => e.address),
        total: entries.length,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

app.delete(
  "/api/launches/:id/whitelist/:address",
  requireAuth,
  (req: AuthRequest, res: Response, next: NextFunction) =>
    attachFullUser(req, res, next),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id, address } = req.params;
      const launch = await prisma.launch.findUnique({ where: { id } });
      if (!launch) {
        return res.status(404).json({ error: "Launch not found" });
      }
      if (launch.creatorId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const result = await prisma.whitelistEntry.deleteMany({
        where: { launchId: id, address },
      });

      if (result.count === 0) {
        return res
          .status(404)
          .json({ error: "Address not found in whitelist" });
      }

      res.status(200).json({ removed: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// Referral codes (auth, creator only)
app.post(
  "/api/launches/:id/referrals",
  requireAuth,
  (req: AuthRequest, res: Response, next: NextFunction) =>
    attachFullUser(req, res, next),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { code, discountPercent, maxUses } = req.body ?? {};

      if (!code || discountPercent == null || maxUses == null) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const launch = await prisma.launch.findUnique({ where: { id } });
      if (!launch) {
        return res.status(404).json({ error: "Launch not found" });
      }
      if (launch.creatorId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const existing = await prisma.referralCode.findFirst({
        where: { launchId: id, code },
      });
      if (existing) {
        return res.status(409).json({ error: "Referral code already exists" });
      }

      const referral = await prisma.referralCode.create({
        data: {
          launchId: id,
          code,
          discountPercent: Number(discountPercent),
          maxUses: Number(maxUses),
        },
      });

      res.status(201).json({
        id: referral.id,
        code: referral.code,
        discountPercent: referral.discountPercent,
        maxUses: referral.maxUses,
        usedCount: referral.usedCount,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

app.get(
  "/api/launches/:id/referrals",
  requireAuth,
  (req: AuthRequest, res: Response, next: NextFunction) =>
    attachFullUser(req, res, next),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const launch = await prisma.launch.findUnique({ where: { id } });
      if (!launch) {
        return res.status(404).json({ error: "Launch not found" });
      }
      if (launch.creatorId !== req.user!.id) {
        return res.status(403).json({ error: "Forbidden" });
      }

      const referrals = await prisma.referralCode.findMany({
        where: { launchId: id },
      });

      res.status(200).json(referrals);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// Helper for tiered pricing
function calculateTieredPrice(params: {
  amount: number;
  basePrice: Prisma.Decimal;
  tiers: {
    minAmount: number;
    maxAmount: number;
    pricePerToken: Prisma.Decimal;
  }[];
}): Prisma.Decimal {
  let remaining = params.amount;
  let totalCost = new Prisma.Decimal(0);

  const sortedTiers = [...params.tiers].sort(
    (a, b) => a.minAmount - b.minAmount,
  );

  for (const tier of sortedTiers) {
    if (remaining <= 0) break;
    const capacity = Math.max(0, tier.maxAmount - tier.minAmount);
    if (capacity <= 0) continue;
    const take = Math.min(remaining, capacity);
    totalCost = totalCost.add(tier.pricePerToken.mul(take));
    remaining -= take;
  }

  if (remaining > 0) {
    totalCost = totalCost.add(params.basePrice.mul(remaining));
  }

  return totalCost;
}

// Token purchases (auth required)
app.post(
  "/api/launches/:id/purchase",
  requireAuth,
  (req: AuthRequest, res: Response, next: NextFunction) =>
    attachFullUser(req, res, next),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { walletAddress, amount, txSignature, referralCode } =
        req.body ?? {};

      if (!walletAddress || amount == null || !txSignature) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const numericAmount = Number(amount);
      if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
        return res.status(400).json({ error: "Invalid amount" });
      }

      const existingTx = await prisma.purchase.findUnique({
        where: { txSignature },
      });
      if (existingTx) {
        return res.status(400).json({ error: "Duplicate transaction" });
      }

      const purchase = await prisma.$transaction(
        async (tx: {
          launch: {
            findUnique: (arg0: {
              where: { id: string };
              include: {
                purchases: { select: { amount: boolean; userId: boolean } };
                tiers: boolean;
                whitelist: boolean;
                referrals: boolean;
              };
            }) => any;
          };
          referralCode: {
            update: (arg0: {
              where: { id: any };
              data: { usedCount: { increment: number } };
            }) => any;
          };
          purchase: {
            create: (arg0: {
              data: {
                launchId: string;
                userId: string;
                walletAddress: any;
                amount: number;
                totalCost: Prisma.Decimal;
                txSignature: any;
              };
            }) => any;
          };
        }) => {
          const launch = await tx.launch.findUnique({
            where: { id },
            include: {
              purchases: { select: { amount: true, userId: true } },
              tiers: true,
              whitelist: true,
              referrals: true,
            },
          });

          if (!launch) {
            throw new Prisma.PrismaClientKnownRequestError("NOT_FOUND", {
              code: "P2025",
              clientVersion: "5.8.0",
            } as any);
          }

          const totalPurchased =
            launch.purchases.reduce(
              (sum: any, p: { amount: any }) => sum + p.amount,
              0,
            ) ?? 0;

          const status = computeLaunchStatus({
            startsAt: launch.startsAt,
            endsAt: launch.endsAt,
            totalSupply: launch.totalSupply,
            totalPurchased,
          });

          if (status !== "ACTIVE") {
            throw new Error("LAUNCH_NOT_ACTIVE");
          }

          if (launch.whitelist.length > 0) {
            const whitelisted = launch.whitelist.some(
              (w: { address: any }) => w.address === walletAddress,
            );
            if (!whitelisted) {
              throw new Error("NOT_WHITELISTED");
            }
          }

          const userId = req.user!.id;
          const userPurchased =
            launch.purchases
              .filter((p: { userId: string }) => p.userId === userId)
              .reduce((sum: any, p: { amount: any }) => sum + p.amount, 0) ?? 0;

          if (userPurchased + numericAmount > launch.maxPerWallet) {
            throw new Error("MAX_PER_WALLET_EXCEEDED");
          }

          if (totalPurchased + numericAmount > launch.totalSupply) {
            throw new Error("EXCEEDS_TOTAL_SUPPLY");
          }

          let totalCost: Prisma.Decimal;
          if (launch.tiers.length > 0) {
            totalCost = calculateTieredPrice({
              amount: numericAmount,
              basePrice: launch.pricePerToken,
              tiers: launch.tiers,
            });
          } else {
            totalCost = launch.pricePerToken.mul(numericAmount);
          }

          let appliedReferralId: string | null = null;
          if (referralCode) {
            const referral = launch.referrals.find(
              (r: { code: any }) => r.code === referralCode,
            );
            if (!referral) {
              throw new Error("INVALID_REFERRAL");
            }
            if (referral.usedCount >= referral.maxUses) {
              throw new Error("REFERRAL_EXHAUSTED");
            }

            const discountMultiplier = 1 - referral.discountPercent / 100;
            if (discountMultiplier < 0) {
              throw new Error("INVALID_REFERRAL");
            }

            totalCost = totalCost.mul(discountMultiplier);
            appliedReferralId = referral.id;

            await tx.referralCode.update({
              where: { id: referral.id },
              data: { usedCount: { increment: 1 } },
            });
          }

          const created = await tx.purchase.create({
            data: {
              launchId: id,
              userId,
              walletAddress,
              amount: numericAmount,
              totalCost,
              txSignature,
            },
          });

          return created;
        },
      );

      res.status(201).json(purchase);
    } catch (err: any) {
      console.error(err);

      if (
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2025"
      ) {
        return res.status(404).json({ error: "Launch not found" });
      }

      if (err instanceof Error) {
        switch (err.message) {
          case "LAUNCH_NOT_ACTIVE":
            return res.status(400).json({ error: "Launch is not ACTIVE" });
          case "NOT_WHITELISTED":
            return res.status(400).json({ error: "Wallet not whitelisted" });
          case "MAX_PER_WALLET_EXCEEDED":
            return res
              .status(400)
              .json({ error: "Exceeds maxPerWallet for this user" });
          case "EXCEEDS_TOTAL_SUPPLY":
            return res.status(400).json({ error: "Exceeds totalSupply" });
          case "INVALID_REFERRAL":
            return res.status(400).json({ error: "Invalid referral code" });
          case "REFERRAL_EXHAUSTED":
            return res
              .status(400)
              .json({ error: "Referral code max uses reached" });
          default:
            break;
        }
      }

      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// Get purchases for a launch
app.get(
  "/api/launches/:id/purchases",
  requireAuth,
  (req: AuthRequest, res: Response, next: NextFunction) =>
    attachFullUser(req, res, next),
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const launch = await prisma.launch.findUnique({ where: { id } });
      if (!launch) {
        return res.status(404).json({ error: "Launch not found" });
      }

      const isCreator = launch.creatorId === req.user!.id;

      const purchases = await prisma.purchase.findMany({
        where: isCreator
          ? { launchId: id }
          : { launchId: id, userId: req.user!.id },
        orderBy: { createdAt: "desc" },
      });

      res.status(200).json({
        purchases,
        total: purchases.length,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

// Vesting schedule
app.get(
  "/api/launches/:id/vesting",
  requireAuth,
  async (req: AuthRequest, res: Response) => {
    try {
      const { id } = req.params;
      const { walletAddress } = req.query as { walletAddress?: string };

      if (!walletAddress) {
        return res.status(400).json({ error: "walletAddress is required" });
      }

      const launch = await prisma.launch.findUnique({
        where: { id },
      });
      if (!launch) {
        return res.status(404).json({ error: "Launch not found" });
      }

      const purchases = await prisma.purchase.findMany({
        where: { launchId: id, walletAddress },
      });

      const totalPurchased =
        purchases.reduce((sum: any, p: { amount: any }) => sum + p.amount, 0) ??
        0;

      if (
        launch.cliffDays == null ||
        launch.vestingDays == null ||
        launch.tgePercent == null
      ) {
        return res.status(200).json({
          totalPurchased,
          tgeAmount: totalPurchased,
          cliffEndsAt: null,
          vestedAmount: totalPurchased,
          lockedAmount: 0,
          claimableAmount: totalPurchased,
        });
      }

      const tgeAmount = Math.floor((totalPurchased * launch.tgePercent) / 100);

      const msPerDay = 24 * 60 * 60 * 1000;
      const cliffEndsAt = new Date(
        launch.startsAt.getTime() + launch.cliffDays * msPerDay,
      );

      const now = new Date();
      let vestedAmount = tgeAmount;

      if (now > cliffEndsAt) {
        const elapsedMs = now.getTime() - cliffEndsAt.getTime();
        const elapsedDays = Math.min(
          launch.vestingDays,
          Math.floor(elapsedMs / msPerDay),
        );

        const remaining = totalPurchased - tgeAmount;
        if (remaining > 0 && launch.vestingDays > 0) {
          const linearVested = Math.floor(
            (remaining * elapsedDays) / launch.vestingDays,
          );
          vestedAmount = tgeAmount + linearVested;
        }
      }

      if (vestedAmount > totalPurchased) {
        vestedAmount = totalPurchased;
      }

      const lockedAmount = totalPurchased - vestedAmount;
      const claimableAmount = vestedAmount;

      res.status(200).json({
        totalPurchased,
        tgeAmount,
        cliffEndsAt,
        vestedAmount,
        lockedAmount,
        claimableAmount,
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  },
);

app.listen(3000, () => {
  console.log("Server running on port 3000");
});
