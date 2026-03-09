import { Express } from "express";
import swaggerUi from "swagger-ui-express";
import swaggerJsdoc from "swagger-jsdoc";

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

export function setupSwagger(app: Express) {
  app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));
}

