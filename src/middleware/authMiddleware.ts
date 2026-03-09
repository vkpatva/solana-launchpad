import { NextFunction, Request, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { prisma } from "../prisma";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

export interface AuthRequest extends Request {
  user?: AuthUser;
}

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET must be defined in environment");
}

export function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
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

    req.user = { id: decoded.userId, email: "", name: "" };
    next();
  } catch {
    return res.status(401).json({ error: "Invalid token" });
  }
}

export async function attachFullUser(
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

