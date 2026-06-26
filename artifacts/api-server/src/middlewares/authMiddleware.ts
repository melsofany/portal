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
    photoUrl?: string;
    permissions?: Record<string, boolean>;
  }

  declare global {
    namespace Express {
      interface Request {
        auth?: AuthPayload;
      }
    }
  }

  function parsePerms(raw: string | null | undefined): Record<string, boolean> {
    try { return raw ? JSON.parse(raw) : {}; } catch { return {}; }
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

    // Always fetch from DB to verify session, isActive, and get live permissions
    try {
      const [user] = await db
        .select({
          sessionToken: usersTable.sessionToken,
          isActive: usersTable.isActive,
          role: usersTable.role,
          permissions: usersTable.permissions,
        })
        .from(usersTable)
        .where(eq(usersTable.id, payload.userId))
        .limit(1);

      if (!user) return res.status(401).json({ error: "المستخدم غير موجود" });
      if (!user.isActive) return res.status(401).json({ error: "هذا الحساب معطل — تواصل مع المدير" });

      if (payload.sessionToken && user.sessionToken !== payload.sessionToken) {
        return res.status(401).json({ error: "تم تسجيل الدخول من جهاز آخر. يرجى تسجيل الدخول مجدداً" });
      }

      // Attach live permissions and role from DB (not just JWT)
      req.auth = {
        ...payload,
        role: user.role,
        permissions: parsePerms(user.permissions),
      };
    } catch {
      // DB error — fall back to JWT data only
      req.auth = payload;
    }

    next();
  }

  /**
   * Middleware factory: require a specific permission key.
   * Admin role bypasses all permission checks.
   */
  export function requirePermission(key: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const auth = req.auth;
      if (!auth) return res.status(401).json({ error: "غير مصرح" });
      if (auth.role === "admin") return next();
      if (!auth.permissions?.[key]) {
        return res.status(403).json({ error: "ليس لديك صلاحية للوصول لهذا المورد" });
      }
      next();
    };
  }

  /**
   * Middleware: require admin role.
   */
  export function requireAdmin(req: Request, res: Response, next: NextFunction) {
    if (!req.auth) return res.status(401).json({ error: "غير مصرح" });
    if (req.auth.role !== "admin") {
      return res.status(403).json({ error: "هذه العملية تتطلب صلاحيات المدير" });
    }
    next();
  }

  export function signToken(payload: AuthPayload): string {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: "7d" });
  }
