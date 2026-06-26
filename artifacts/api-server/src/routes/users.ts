import { Router } from "express";
  import bcrypt from "bcryptjs";
  import { db, usersTable } from "@workspace/db";
  import { employeesTable } from "@workspace/db/schema";
  import { eq } from "drizzle-orm";

  const router = Router();

  // GET /api/users — list all users with employee info
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
        createdAt: usersTable.createdAt,
      }).from(usersTable).orderBy(usersTable.id);
      res.json(users);
    } catch (err) {
      req.log.error(err, "GET /users failed");
      res.status(500).json({ error: "فشل في جلب المستخدمين" });
    }
  });

  // POST /api/users — create user
  router.post("/", async (req, res) => {
    try {
      const { username, email, password, fullName, role, employeeId, permissions } = req.body;
      if (!username || !password) {
        return res.status(400).json({ error: "اسم المستخدم وكلمة المرور مطلوبان" });
      }
      const passwordHash = await bcrypt.hash(password, 10);
      const [user] = await db.insert(usersTable).values({
        username: username.trim(),
        email: email?.trim() || null,
        fullName: fullName?.trim() || "",
        passwordHash,
        role: role || "user",
        employeeId: employeeId ? Number(employeeId) : null,
        permissions: typeof permissions === "object" ? JSON.stringify(permissions) : (permissions || "{}"),
        isActive: true,
      }).returning({
        id: usersTable.id, username: usersTable.username, email: usersTable.email,
        fullName: usersTable.fullName, role: usersTable.role, employeeId: usersTable.employeeId,
        permissions: usersTable.permissions, isActive: usersTable.isActive,
      });
      res.status(201).json(user);
    } catch (err: any) {
      if (err?.code === "23505") return res.status(409).json({ error: "اسم المستخدم مستخدم بالفعل" });
      req.log.error(err, "POST /users failed");
      res.status(500).json({ error: "فشل في إنشاء المستخدم" });
    }
  });

  // PUT /api/users/:id — update user
  router.put("/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { email, fullName, role, employeeId, permissions, isActive, password } = req.body;
      const updates: Record<string, any> = {
        email: email?.trim() || null,
        fullName: fullName?.trim() || "",
        role: role || "user",
        employeeId: employeeId ? Number(employeeId) : null,
        permissions: typeof permissions === "object" ? JSON.stringify(permissions) : (permissions || "{}"),
        isActive: isActive !== undefined ? Boolean(isActive) : true,
      };
      if (password) {
        updates.passwordHash = await bcrypt.hash(password, 10);
        updates.sessionToken = null; // invalidate sessions
      }
      const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning({
        id: usersTable.id, username: usersTable.username, email: usersTable.email,
        fullName: usersTable.fullName, role: usersTable.role, employeeId: usersTable.employeeId,
        permissions: usersTable.permissions, isActive: usersTable.isActive,
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
  