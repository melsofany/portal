import { Router } from "express";
  import bcrypt from "bcryptjs";
  import { db, usersTable } from "@workspace/db";
  import { employeesTable } from "@workspace/db/schema";
  import { eq } from "drizzle-orm";

  const router = Router();

  // GET /api/users
  router.get("/", async (req, res) => {
    try {
      const users = await db.select({
        id: usersTable.id,
        username: usersTable.username,
        email: usersTable.email,
        fullName: usersTable.fullName,
        role: usersTable.role,
        employeeId: usersTable.employeeId,
        permissions: usersTable.permissions,
        isActive: usersTable.isActive,
        photoUrl: usersTable.photoUrl,
        createdAt: usersTable.createdAt,
      }).from(usersTable).orderBy(usersTable.id);
      res.json(users);
    } catch (err) {
      req.log.error(err, "GET /users failed");
      res.status(500).json({ error: "فشل في جلب المستخدمين" });
    }
  });

  // POST /api/users — requires employeeId; auto-generates username from employee number
  router.post("/", async (req, res) => {
    try {
      const { password, employeeId, permissions, role, isActive, photoUrl } = req.body;

      if (!employeeId) {
        return res.status(400).json({ error: "يجب تحديد الموظف — لا يمكن إنشاء مستخدم بدون ربطه بموظف" });
      }
      if (!password) {
        return res.status(400).json({ error: "كلمة المرور مطلوبة" });
      }

      // Fetch employee to get name, email, number
      const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, Number(employeeId))).limit(1);
      if (!employee) {
        return res.status(404).json({ error: "الموظف غير موجود" });
      }
      if (!employee.email) {
        return res.status(400).json({ error: "لا يوجد بريد إلكتروني مسجل لهذا الموظف — يرجى إضافة الإيميل في بيانات الموظف أولاً" });
      }

      // username = employee number (unique, auto-generated)
      const username = employee.employeeNumber;
      const passwordHash = await bcrypt.hash(password, 10);

      const [user] = await db.insert(usersTable).values({
        username,
        email: employee.email.trim().toLowerCase(),
        fullName: employee.fullName,
        passwordHash,
        role: role || "user",
        employeeId: Number(employeeId),
        permissions: typeof permissions === "object" ? JSON.stringify(permissions) : (permissions || "{}"),
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        photoUrl: photoUrl || "",
      }).returning({
        id: usersTable.id, username: usersTable.username, email: usersTable.email,
        fullName: usersTable.fullName, role: usersTable.role, employeeId: usersTable.employeeId,
        permissions: usersTable.permissions, isActive: usersTable.isActive, photoUrl: usersTable.photoUrl,
      });
      res.status(201).json(user);
    } catch (err: any) {
      if (err?.code === "23505") return res.status(409).json({ error: "هذا الموظف لديه حساب مستخدم بالفعل" });
      req.log.error(err, "POST /users failed");
      res.status(500).json({ error: "فشل في إنشاء المستخدم" });
    }
  });

  // PUT /api/users/:id
  router.put("/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { role, employeeId, permissions, isActive, password, photoUrl } = req.body;

      const updates: Record<string, any> = {
        role: role || "user",
        permissions: typeof permissions === "object" ? JSON.stringify(permissions) : (permissions || "{}"),
        isActive: isActive !== undefined ? Boolean(isActive) : true,
        photoUrl: photoUrl ?? "",
      };

      // If employee changed, re-sync name/email
      if (employeeId) {
        const [employee] = await db.select().from(employeesTable).where(eq(employeesTable.id, Number(employeeId))).limit(1);
        if (employee) {
          updates.employeeId = Number(employeeId);
          updates.fullName = employee.fullName;
          if (employee.email) updates.email = employee.email.trim().toLowerCase();
        }
      }

      if (password) {
        updates.passwordHash = await bcrypt.hash(password, 10);
        updates.sessionToken = null;
      }

      const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning({
        id: usersTable.id, username: usersTable.username, email: usersTable.email,
        fullName: usersTable.fullName, role: usersTable.role, employeeId: usersTable.employeeId,
        permissions: usersTable.permissions, isActive: usersTable.isActive, photoUrl: usersTable.photoUrl,
      });
      if (!updated) return res.status(404).json({ error: "المستخدم غير موجود" });
      res.json(updated);
    } catch (err) {
      req.log.error(err, "PUT /users/:id failed");
      res.status(500).json({ error: "فشل في تحديث المستخدم" });
    }
  });

  // DELETE /api/users/:id
  router.delete("/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [deleted] = await db.delete(usersTable).where(eq(usersTable.id, id)).returning({ id: usersTable.id });
      if (!deleted) return res.status(404).json({ error: "المستخدم غير موجود" });
      res.json({ success: true });
    } catch (err) {
      req.log.error(err, "DELETE /users/:id failed");
      res.status(500).json({ error: "فشل في حذف المستخدم" });
    }
  });

  export default router;
  