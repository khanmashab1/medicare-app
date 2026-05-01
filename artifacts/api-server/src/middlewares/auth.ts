import type { Request, Response, NextFunction } from "express";
import type { User } from "@supabase/supabase-js";
import { admin } from "../lib/supabase";

export interface AuthRequest extends Request {
  user: User;
  jwt: string;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization ?? "";
  if (!header.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing bearer token" });
    return;
  }
  const token = header.slice(7);
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data?.user) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }
  (req as AuthRequest).user = data.user;
  (req as AuthRequest).jwt = token;
  next();
}
