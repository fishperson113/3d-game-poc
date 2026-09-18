import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import express, { type NextFunction, type Request, type Response } from "express";
import { fromNodeHeaders, toNodeHandler } from "better-auth/node";
import { getMigrations } from "better-auth/db/migration";
import { auth } from "./auth";
import { database, migrateApplicationTables } from "./database";

const scrypt = promisify(scryptCallback);
const app = express();
const port = Number(process.env.PORT ?? 3000);
const isProduction = process.env.NODE_ENV === "production";
const childCookie = "besiege_child_session";

await (await getMigrations(auth.options)).runMigrations();
migrateApplicationTables();

app.set("trust proxy", 1);
app.all("/api/auth/*splat", toNodeHandler(auth));
app.use(express.json({ limit: "256kb" }));

function asyncRoute(handler: (request: Request, response: Response) => Promise<void>): (request: Request, response: Response, next: NextFunction) => void {
  return (request, response, next) => { handler(request, response).catch(next); };
}

function sameOrigin(request: Request, response: Response, next: NextFunction): void {
  if (request.method === "GET" || request.method === "HEAD") { next(); return; }
  const fetchSite = request.get("sec-fetch-site");
  if (fetchSite !== undefined && fetchSite !== "same-origin" && fetchSite !== "none") {
    response.status(403).json({ error: "Yêu cầu không hợp lệ." });
    return;
  }
  next();
}
app.use("/api", sameOrigin);

function objectBody(request: Request): Record<string, unknown> {
  const body: unknown = request.body;
  return typeof body === "object" && body !== null && !Array.isArray(body) ? body as Record<string, unknown> : {};
}

interface ChildRow {
  id: string;
  parent_user_id: string;
  display_name: string;
  login_code: string;
  pin_hash: string;
  created_at: number;
}

interface ChildAccess {
  child: ChildRow;
}

async function parentSession(request: Request): Promise<Awaited<ReturnType<typeof auth.api.getSession>>> {
  return auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await scrypt(pin, salt, 32) as Buffer;
  return `${salt.toString("hex")}:${derived.toString("hex")}`;
}

async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [saltHex, expectedHex] = stored.split(":");
  if (saltHex === undefined || expectedHex === undefined) return false;
  const actual = await scrypt(pin, Buffer.from(saltHex, "hex"), 32) as Buffer;
  const expected = Buffer.from(expectedHex, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function childAccess(request: Request): ChildAccess | null {
  const rawCookie = request.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${childCookie}=`));
  const token = rawCookie?.slice(childCookie.length + 1);
  if (!token) return null;
  const row = database.prepare(`
    SELECT p.* FROM child_session s
    JOIN child_profile p ON p.id = s.child_id
    WHERE s.token_hash = ? AND s.expires_at > ?
  `).get(hashToken(decodeURIComponent(token)), Date.now()) as ChildRow | undefined;
  return row === undefined ? null : { child: row };
}

function publicChild(row: ChildRow): object {
  return { id: row.id, name: row.display_name, loginCode: row.login_code, createdAt: row.created_at };
}

app.get("/api/access", asyncRoute(async (request, response) => {
  const session = await parentSession(request);
  if (session !== null) {
    const unread = database.prepare("SELECT COUNT(*) AS count FROM parent_notification WHERE parent_user_id = ? AND read_at IS NULL").get(session.user.id) as { count: number };
    response.json({ role: "parent", user: { id: session.user.id, name: session.user.name, email: session.user.email }, unread: unread.count });
    return;
  }
  const access = childAccess(request);
  if (access !== null) {
    response.json({ role: "child", child: { id: access.child.id, name: access.child.display_name } });
    return;
  }
  response.status(401).json({ role: "guest" });
}));

app.get("/api/family", asyncRoute(async (request, response) => {
  const session = await parentSession(request);
  if (session === null) { response.status(401).json({ error: "Bạn cần đăng nhập tài khoản phụ huynh." }); return; }
  const children = database.prepare("SELECT * FROM child_profile WHERE parent_user_id = ? ORDER BY created_at").all(session.user.id) as unknown as ChildRow[];
  const notifications = database.prepare(`
    SELECT n.id, n.message, n.created_at AS createdAt, n.read_at AS readAt, p.display_name AS childName
    FROM parent_notification n JOIN child_profile p ON p.id = n.child_id
    WHERE n.parent_user_id = ? ORDER BY n.created_at DESC LIMIT 30
  `).all(session.user.id);
  response.json({ children: children.map(publicChild), notifications });
}));

app.post("/api/children", asyncRoute(async (request, response) => {
  const session = await parentSession(request);
  if (session === null) { response.status(401).json({ error: "Bạn cần đăng nhập tài khoản phụ huynh." }); return; }
  const body = objectBody(request);
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const pin = typeof body.pin === "string" ? body.pin : "";
  if (name.length < 1 || name.length > 40 || !/^\d{4}$/.test(pin)) {
    response.status(400).json({ error: "Tên cần từ 1–40 ký tự và PIN gồm đúng 4 chữ số." }); return;
  }
  let loginCode = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
  while (database.prepare("SELECT 1 FROM child_profile WHERE login_code = ?").get(loginCode) !== undefined) {
    loginCode = randomBytes(4).toString("hex").slice(0, 6).toUpperCase();
  }
  const row: ChildRow = { id: randomUUID(), parent_user_id: session.user.id, display_name: name, login_code: loginCode, pin_hash: await hashPin(pin), created_at: Date.now() };
  database.prepare("INSERT INTO child_profile (id, parent_user_id, display_name, login_code, pin_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(row.id, row.parent_user_id, row.display_name, row.login_code, row.pin_hash, row.created_at);
  response.status(201).json({ child: publicChild(row) });
}));

const attempts = new Map<string, { count: number; resetAt: number }>();
app.post("/api/child/login", asyncRoute(async (request, response) => {
  const key = request.ip ?? "unknown";
  const now = Date.now();
  const attempt = attempts.get(key);
  if (attempt !== undefined && attempt.resetAt > now && attempt.count >= 10) {
    response.status(429).json({ error: "Quá nhiều lần thử. Vui lòng đợi 15 phút." }); return;
  }
  if (attempt === undefined || attempt.resetAt <= now) attempts.set(key, { count: 1, resetAt: now + 15 * 60_000 });
  else attempt.count += 1;
  const body = objectBody(request);
  const code = typeof body.code === "string" ? body.code.trim().toUpperCase() : "";
  const pin = typeof body.pin === "string" ? body.pin : "";
  const child = database.prepare("SELECT * FROM child_profile WHERE login_code = ?").get(code) as ChildRow | undefined;
  if (child === undefined || !/^\d{4}$/.test(pin) || !(await verifyPin(pin, child.pin_hash))) {
    response.status(401).json({ error: "Mã hồ sơ hoặc PIN chưa đúng." }); return;
  }
  attempts.delete(key);
  const token = randomBytes(32).toString("base64url");
  const createdAt = Date.now();
  database.prepare("DELETE FROM child_session WHERE expires_at <= ?").run(createdAt);
  database.prepare("INSERT INTO child_session (token_hash, child_id, expires_at, created_at) VALUES (?, ?, ?, ?)")
    .run(hashToken(token), child.id, createdAt + 12 * 60 * 60_000, createdAt);
  database.prepare("INSERT INTO parent_notification (id, parent_user_id, child_id, message, created_at) VALUES (?, ?, ?, ?, ?)")
    .run(randomUUID(), child.parent_user_id, child.id, `${child.display_name} vừa đăng nhập vào STEM Car Lab.`, createdAt);
  response.cookie(childCookie, token, { httpOnly: true, sameSite: "lax", secure: isProduction, maxAge: 12 * 60 * 60_000, path: "/" });
  response.json({ child: { id: child.id, name: child.display_name } });
}));

app.post("/api/child/logout", (request, response) => {
  const access = childAccess(request);
  const raw = request.headers.cookie?.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${childCookie}=`));
  if (raw !== undefined) database.prepare("DELETE FROM child_session WHERE token_hash = ?").run(hashToken(decodeURIComponent(raw.slice(childCookie.length + 1))));
  response.clearCookie(childCookie, { path: "/" });
  response.json({ ok: access !== null });
});

app.post("/api/notifications/read", asyncRoute(async (request, response) => {
  const session = await parentSession(request);
  if (session === null) { response.status(401).json({ error: "Bạn cần đăng nhập." }); return; }
  database.prepare("UPDATE parent_notification SET read_at = ? WHERE parent_user_id = ? AND read_at IS NULL").run(Date.now(), session.user.id);
  response.json({ ok: true });
}));

app.post("/api/products", asyncRoute(async (request, response) => {
  const session = await parentSession(request);
  const child = childAccess(request)?.child;
  const parentUserId = session?.user.id ?? child?.parent_user_id;
  if (parentUserId === undefined) { response.status(401).json({ error: "Bạn cần đăng nhập." }); return; }
  const body = objectBody(request);
  const imageUrl = typeof body.imageUrl === "string" ? body.imageUrl.trim() : "";
  const input: unknown = body.input;
  if (imageUrl.length < 1 || imageUrl.length > 2048 || typeof input !== "object" || input === null || Array.isArray(input)) {
    response.status(400).json({ error: "Cần ảnh sản phẩm và thông tin sản phẩm hợp lệ." }); return;
  }
  const serialized = JSON.stringify(input);
  if (serialized.length > 200_000) { response.status(413).json({ error: "Thông tin sản phẩm quá lớn." }); return; }
  const id = randomUUID();
  database.prepare("INSERT INTO product_record (id, parent_user_id, child_id, image_url, input_json, created_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(id, parentUserId, child?.id ?? null, imageUrl, serialized, Date.now());
  response.status(201).json({ id });
}));

app.get("/api/health", (_request, response) => { response.json({ ok: true }); });
app.use(express.static("dist", { index: false }));
app.get("*splat", (_request, response) => { response.sendFile("index.html", { root: "dist" }); });
app.use((error: unknown, _request: Request, response: Response, _next: NextFunction) => {
  void _next;
  console.error(error);
  response.status(500).json({ error: "Có lỗi xảy ra. Vui lòng thử lại." });
});

app.listen(port, () => { console.log(`STEM Car Lab listening on http://localhost:${String(port)}`); });
