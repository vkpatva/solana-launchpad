import { Response } from "express";
import { prisma } from "../prisma";
import { AuthRequest } from "../middleware/authMiddleware";

export async function createReferral(req: AuthRequest, res: Response) {
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

    return res.status(201).json({
      id: referral.id,
      code: referral.code,
      discountPercent: referral.discountPercent,
      maxUses: referral.maxUses,
      usedCount: referral.usedCount,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function listReferrals(req: AuthRequest, res: Response) {
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

    return res.status(200).json(referrals);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

