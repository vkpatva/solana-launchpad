import { Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { AuthRequest } from "../middleware/authMiddleware";
import { computeLaunchStatus } from "../utils/launchStatus";

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

export async function createPurchase(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const { walletAddress, amount, txSignature, referralCode } = req.body ?? {};

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

    const purchase = await prisma.$transaction(async (tx) => {
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
          (sum, p) => sum + p.amount,
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
          (w) => w.address === walletAddress,
        );
        if (!whitelisted) {
          throw new Error("NOT_WHITELISTED");
        }
      }

      const userId = req.user!.id;
      const userPurchased =
        launch.purchases
          .filter((p) => p.userId === userId)
          .reduce((sum, p) => sum + p.amount, 0) ?? 0;

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

      if (referralCode) {
        const referral = launch.referrals.find(
          (r) => r.code === referralCode,
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
    });

    return res.status(201).json(purchase);
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

    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function listPurchases(req: AuthRequest, res: Response) {
  try {
    const { id } = req.params;
    const launch = await prisma.launch.findUnique({ where: { id } });
    if (!launch) {
      return res.status(404).json({ error: "Launch not found" });
    }

    const isCreator = launch.creatorId === req.user!.id;

    const purchases = await prisma.purchase.findMany({
      where: isCreator ? { launchId: id } : { launchId: id, userId: req.user!.id },
      orderBy: { createdAt: "desc" },
    });

    return res.status(200).json({
      purchases,
      total: purchases.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

