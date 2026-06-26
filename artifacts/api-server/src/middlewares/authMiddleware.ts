import type { Request, Response, NextFunction } from "express";
  import jwt from "jsonwebtoken";
  import { db, usersTable } from "@workspace/db";
  import { eq } from "drizzle-orm";

  const JWT_SECRET = process.env.SESSION_SECRET || "fallback-dev-secret";

  export interface AuthPayload {
    userId: number;
    username: string;
    fullName: string;
    role: string;
    sessionToken?: string;
  }

  declare global {
    namespace Express {
      interface Request {
        auth?: AuthPayload;
      }
    }
  }

  export async function requireAuth(req: Request, res: Response, next: NextFunction) {
    let token: string | undefined;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    } else {
      token = (req as any).cookies?.auth_token;
    }
    if (!token) return res.status(401).json({ error: "غير مصرح" });

    let payload: AuthPayload;
    try {
      payload = jwt.verify(token, JWT_SECRET) as AuthPayload;
    } catch {
      return res.status(401).json({ error: "جلسة منتهية، يرجى تسجيل الدخول مجدداً" });
    }

    // Single-session check: verify sessionToken still matches DB
    if (payload.sessionToken) {
      try {
        const [user] = await db
          .select({ sessionToken: usersTable.sessionToken })
          .from(usersTable)
          .where(eq(usersTable.id, payload.userId))
          .limit(1);

        if (!user || user.sessionToken !== payload.sessionToken) {
          return res.status(401).json({ error: "تم تسجيل الدخول من جهاز آخر. يرجى تسجيل الدخول مجدداً" });
        }
      } catch {
        // DB error — allow through to avoid locking everyone out
      }
    }

    req.auth = payload;
    next();
  }

  export function signToken(payload: AuthPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
  }
  