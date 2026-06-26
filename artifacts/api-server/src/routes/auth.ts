import { Router } from "express";
import { randomUUID } from "crypto";
import bcrypt from "bcryptjs";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, signToken } from "../middlewares/authMiddleware";

const router = Router();

async function ensureDefaultAdmin() {
  try {
    const users = await db.select({ id: usersTable.id }).from(usersTable).limit(1);
    if (users.length === 0) {
      const hash = await bcrypt.hash("admin123", 10);
      await db.insert(usersTable).values({
        username: "admin",
        email: "admin@company.com",
        fullName: "المدير",
        passwordHash: hash,
        role: "admin",
      });
      console.log("[auth] Default admin created");
    }
  } catch (err) {
    console.error("[auth] ensureDefaultAdmin failed:", err);
  }
}

ensureDefaultAdmin();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: "البريد الإلكتروني وكلمة المرور مطلوبان" });
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.email, email.trim().toLowerCase()))
      .limit(1);

    if (!user) {
      return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    }

    // Generate a new sessionToken — invalidates any existing session
    const sessionToken = randomUUID();
    await db.update(usersTable).set({ sessionToken }).where(eq(usersTable.id, user.id));

    const jwtToken = signToken({
      userId: user.id,
      username: user.username,
      fullName: user.fullName || "",
      role: user.role,
      sessionToken,
    });

    const isProduction = process.env.NODE_ENV === "production";
    res
      .cookie("auth_token", jwtToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? "none" : "lax",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      })
      .json({
        userId: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        token: jwtToken,
      });
  } catch (err: any) {
    res.status(500).json({ error: "فشل تسجيل الدخول" });
  }
});

// POST /api/auth/logout
router.post("/logout", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    let token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : (req as any).cookies?.auth_token;
    if (token) {
      const jwt = await import("jsonwebtoken");
      const JWT_SECRET = process.env.SESSION_SECRET || "fallback-dev-secret";
      try {
        const payload = jwt.default.verify(token, JWT_SECRET) as any;
        if (payload?.userId) {
          await db.update(usersTable).set({ sessionToken: null }).where(eq(usersTable.id, payload.userId));
        }
      } catch {}
    }
  } catch {}

  const isProduction = process.env.NODE_ENV === "production";
  res.clearCookie("auth_token", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
  }).json({ success: true });
});

// GET /api/auth/me
router.get("/me", requireAuth, (req, res) => {
  res.json(req.auth);
});

export default router;
