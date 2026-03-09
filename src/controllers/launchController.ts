import { Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { prisma } from "../prisma";
import { AuthRequest } from "../middleware/authMiddleware";
import { computeLaunchStatus } from "../utils/launchStatus";

export async function buildLaunchResponse(launchId: string) {
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
      (sum: number, p: { amount: number }) => sum + p.amount,
      0,
    ) ?? 0;
  const status = computeLaunchStatus({
    startsAt: launch.startsAt,
    endsAt: launch.endsAt,
    totalSupply: launch.totalSupply,
    totalPurchased,
  });

  const { purchases, ...rest } = launch;
  return { ...rest, status, totalPurchased };
}

export async function createLaunch(req: AuthRequest, res: Response) {
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
    return res.status(201).json(launchWithStatus);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function listLaunches(req: Request, res: Response) {
  try {
    const {
      page = "1",
      limit = "10",
      status,
    } = req.query as { page?: string; limit?: string; status?: string };

    const pageNum = Math.max(1, parseInt(page || "1", 10) || 1);
    const pageSize = Math.max(
      1,
      Math.min(100, parseInt(limit || "10", 10) || 10),
    );

    const statusFilter = status as
      | "SOLD_OUT"
      | "UPCOMING"
      | "ENDED"
      | "ACTIVE"
      | undefined;

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

    return res.status(200).json({
      launches: enriched,
      total,
      page: pageNum,
      limit: pageSize,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function getLaunch(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const launchWithStatus = await buildLaunchResponse(id);
    if (!launchWithStatus) {
      return res.status(404).json({ error: "Launch not found" });
    }
    return res.status(200).json(launchWithStatus);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateLaunch(req: AuthRequest, res: Response) {
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

    return res.status(200).json(launchWithStatus);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
