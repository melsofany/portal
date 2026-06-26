import { Router } from "express";
    import { randomUUID } from "crypto";
    import bcrypt from "bcryptjs";
    import { db, usersTable } from "@workspace/db";
    import { eq } from "drizzle-orm";
    import { requireAuth, signToken } from "../middlewares/authMiddleware";

    const router = Router();

    const MAX_FAILED_ATTEMPTS = 4;

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

        if (!user) return res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
        if (!user.isActive) return res.status(401).json({ error: "هذا الحساب معطل — تواصل مع المدير" });

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) {
          const newAttempts = (user.failedLoginAttempts ?? 0) + 1;
          if (newAttempts >= MAX_FAILED_ATTEMPTS) {
            // Auto-disable after 4 failed attempts
            await db.update(usersTable)
              .set({ failedLoginAttempts: newAttempts, isActive: false })
              .where(eq(usersTable.id, user.id));
            return res.status(401).json({
              error: `تم إيقاف الحساب تلقائياً بسبب ${MAX_FAILED_ATTEMPTS} محاولات دخول خاطئة — تواصل مع المدير لإعادة التفعيل`,
            });
          }
          await db.update(usersTable)
            .set({ failedLoginAttempts: newAttempts })
            .where(eq(usersTable.id, user.id));
          const remaining = MAX_FAILED_ATTEMPTS - newAttempts;
          return res.status(401).json({
            error: `كلمة المرور غير صحيحة — تبقى ${remaining} محاولة قبل إيقاف الحساب`,
          });
        }

        // Success — reset failed attempts
        const sessionToken = randomUUID();
        await db.update(usersTable)
          .set({ sessionToken, failedLoginAttempts: 0 })
          .where(eq(usersTable.id, user.id));

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
            photoUrl: user.photoUrl || "",
            permissions: user.permissions || "{}",
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
    router.get("/me", requireAuth, async (req, res) => {
      try {
        const [user] = await db
          .select({
            userId: usersTable.id,
            username: usersTable.username,
            fullName: usersTable.fullName,
            role: usersTable.role,
            photoUrl: usersTable.photoUrl,
            isActive: usersTable.isActive,
            permissions: usersTable.permissions,
          })
          .from(usersTable)
          .where(eq(usersTable.id, req.auth!.userId))
          .limit(1);

        if (!user) return res.status(401).json({ error: "المستخدم غير موجود" });
        if (!user.isActive) return res.status(401).json({ error: "هذا الحساب معطل" });

        res.json({ ...user, photoUrl: user.photoUrl || "" });
      } catch {
        res.json(req.auth);
      }
    });

    // PUT /api/auth/profile — update own password and/or photo
    router.put("/profile", requireAuth, async (req, res) => {
      try {
        const { password, photoUrl } = req.body;
        const updates: Record<string, any> = {};

        if (photoUrl !== undefined) updates.photoUrl = photoUrl;
        if (password) {
          if (password.length < 6) {
            return res.status(400).json({ error: "كلمة المرور قصيرة جداً (6 أحرف على الأقل)" });
          }
          updates.passwordHash = await bcrypt.hash(password, 10);
        }

        if (Object.keys(updates).length === 0) {
          return res.status(400).json({ error: "لا توجد تعديلات" });
        }

        const [updated] = await db
          .update(usersTable)
          .set(updates)
          .where(eq(usersTable.id, req.auth!.userId))
          .returning({
            id: usersTable.id,
            username: usersTable.username,
            fullName: usersTable.fullName,
            role: usersTable.role,
            photoUrl: usersTable.photoUrl,
          });

        res.json(updated);
      } catch (err: any) {
        res.status(500).json({ error: "فشل تحديث الملف الشخصي" });
      }
    });

    export default router;
