import { Response } from "express";
import { prisma } from "../prisma";
import { AuthRequest } from "../middleware/authMiddleware";

export async function getVesting(req: AuthRequest, res: Response) {
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

    return res.status(200).json({
      totalPurchased,
      tgeAmount,
      cliffEndsAt,
      vestedAmount,
      lockedAmount,
      claimableAmount,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
