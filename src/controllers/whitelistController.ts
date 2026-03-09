import { Response } from "express";
import { prisma } from "../prisma";
import { AuthRequest } from "../middleware/authMiddleware";

export async function addToWhitelist(req: AuthRequest, res: Response) {
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

    return res.status(200).json({ added: result.count, total });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getWhitelist(req: AuthRequest, res: Response) {
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

    return res.status(200).json({
      addresses: entries.map((e: { address: any }) => e.address),
      total: entries.length,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function removeFromWhitelist(req: AuthRequest, res: Response) {
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
      return res.status(404).json({ error: "Address not found in whitelist" });
    }

    return res.status(200).json({ removed: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
