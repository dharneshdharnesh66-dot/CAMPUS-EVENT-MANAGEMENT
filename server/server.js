import mongoose5 from "mongoose";
import { randomBytes as randomBytes4 } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

import express from "express";
import session from "express-session";
import MongoStore from "connect-mongo";

import { scrypt, randomBytes, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
var derive = promisify(scrypt);
var options = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
async function hashPassword(password) {
  const salt = randomBytes(16);
  const key = await derive(password, salt, 64, options);
  return ["scrypt", options.N, options.r, options.p, salt.toString("base64url"), key.toString("base64url")].join("$");
}
async function verifyPassword(encoded, password) {
  if (typeof encoded !== "string" || typeof password !== "string") return false;
  const parts = encoded.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt" || parts[1] !== "131072" || parts[2] !== "8" || parts[3] !== "1") return false;
  if (!/^[A-Za-z0-9_-]{22}$/.test(parts[4]) || !/^[A-Za-z0-9_-]{86}$/.test(parts[5])) return false;
  const salt = Buffer.from(parts[4], "base64url");
  const expected = Buffer.from(parts[5], "base64url");
  if (salt.length !== 16 || expected.length !== 64 || salt.toString("base64url") !== parts[4] || expected.toString("base64url") !== parts[5]) return false;
  const actual = await derive(password, salt, expected.length, options);
  return timingSafeEqual(actual, expected);
}

import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { randomBytes as randomBytes3, timingSafeEqual as timingSafeEqual2 } from "node:crypto";

import mongoose from "mongoose";
import { randomUUID } from "node:crypto";
var userSchema = new mongoose.Schema({
  studentId: { type: String, unique: true, default: () => `STU-${randomUUID()}` },
  name: { type: String, required: true, trim: true, maxlength: 60 },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ["student", "admin"], default: "student" },
  course: { type: String, maxlength: 40, default: "" },
  year: { type: String, enum: ["", "First year", "Second year", "Third year", "Fourth year"], default: "" },
  bio: { type: String, maxlength: 200, default: "" }
}, { timestamps: true });
var eventSchema = new mongoose.Schema({
  type: { type: String, enum: ["College", "Outside"], required: true },
  host: { type: String, required: true, maxlength: 100 },
  feePaise: { type: Number, required: true, min: 0, max: 1e7, validate: Number.isSafeInteger },
  title: { type: String, required: true, maxlength: 100 },
  category: { type: String, enum: ["Technology", "Culture", "Workshop", "Sports", "Other"], required: true },
  description: { type: String, required: true, maxlength: 2e3 },
  startsAt: { type: Date, required: true },
  venue: { type: String, required: true, maxlength: 120 },
  organizer: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  cancelled: { type: Boolean, default: false }
}, { timestamps: true });
var registrationSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: "CampusEvent", required: true },
  paymentMode: { type: String, enum: ["free", "simulation"], required: true },
  ticketToken: { type: String, unique: true, sparse: true, select: false },
  checkedInAt: { type: Date, default: null },
  checkedInBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
}, { timestamps: true });
registrationSchema.index({ student: 1, event: 1 }, { unique: true });
var User = mongoose.model("User", userSchema);
var CampusEvent = mongoose.model("CampusEvent", eventSchema);
var Registration = mongoose.model("Registration", registrationSchema);
var paymentSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  event: { type: mongoose.Schema.Types.ObjectId, ref: "CampusEvent", required: true },
  amountPaise: { type: Number, required: true },
  currency: { type: String, enum: ["INR"], default: "INR" },
  mode: { type: String, enum: ["simulation"], default: "simulation" },
  status: { type: String, enum: ["pending", "success", "failure", "cancelled"], default: "pending" }
}, { timestamps: true });
var TestPayment = mongoose.model("TestPayment", paymentSchema);
var notificationReadSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  key: { type: String, required: true },
  readAt: { type: Date, default: Date.now }
});
notificationReadSchema.index({ user: 1, key: 1 }, { unique: true });
var NotificationRead = mongoose.model("NotificationRead", notificationReadSchema);
var studentMessageSchema = new mongoose.Schema({
  student: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  sender: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  senderName: { type: String, required: true, maxlength: 60 },
  senderRole: { type: String, enum: ["student", "admin"], required: true },
  body: { type: String, required: true, maxlength: 2e3 },
  clientId: { type: String, required: true },
  readAt: { type: Date, default: null }
}, { timestamps: true });
studentMessageSchema.index({ student: 1, _id: -1 });
studentMessageSchema.index({ sender: 1, clientId: 1 }, { unique: true });
var StudentMessage = mongoose.model("StudentMessage", studentMessageSchema);

function addNotificationRoutes(app, { requireUser, route }) {
  async function feed(user) {
    const now = /* @__PURE__ */ new Date(), soon = new Date(now.getTime() + 60 * 60 * 1e3);
    const events = await CampusEvent.find({ cancelled: false, startsAt: { $gt: now }, createdAt: { $gte: user.createdAt } }).sort({ createdAt: -1 }).limit(100);
    const notices = events.map((event) => ({ id: `new:${event.id}`, kind: "new-event", title: "New event posted", eventId: event.id, eventTitle: event.title, startsAt: event.startsAt, createdAt: event.createdAt }));
    if (user.role === "student") {
      const rows = await Registration.find({ student: user.id }).populate({ path: "event", match: { cancelled: false, startsAt: { $gt: now, $lte: soon } } });
      for (const row of rows) if (row.event) notices.push({ id: `reminder:${row.event.id}`, kind: "reminder", title: "Your registered event starts within 1 hour", eventId: row.event.id, eventTitle: row.event.title, startsAt: row.event.startsAt, createdAt: new Date(Math.max(row.event.startsAt.getTime() - 36e5, row.createdAt.getTime())) });
    }
    notices.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const selected = notices.slice(0, 100);
    const read = new Set((await NotificationRead.find({ user: user.id, key: { $in: selected.map((n) => n.id) } }).select("key")).map((n) => n.key));
    return selected.map((n) => ({ ...n, read: read.has(n.id) }));
  }
  app.get("/api/notifications", requireUser, route(async (req, res) => {
    const notifications = await feed(req.user);
    res.json({ notifications, unreadCount: notifications.filter((n) => !n.read).length, limit: 100, serverTime: /* @__PURE__ */ new Date() });
  }));
  app.post("/api/notifications/read", requireUser, route(async (req, res) => {
    if (!Array.isArray(req.body.ids) || req.body.ids.length > 100 || req.body.ids.some((id) => typeof id !== "string" || !/^(new|reminder):[a-f0-9]{24}$/.test(id))) return res.status(400).json({ error: "Choose up to 100 notification IDs." });
    const available = new Set((await feed(req.user)).map((n) => n.id));
    const ids = [...new Set(req.body.ids)].filter((id) => available.has(id));
    if (ids.length) await NotificationRead.bulkWrite(ids.map((key) => ({ updateOne: { filter: { user: req.user.id, key }, update: { $setOnInsert: { readAt: /* @__PURE__ */ new Date() } }, upsert: true } })));
    res.json({ ok: true });
  }));
}

import mongoose2 from "mongoose";
var validId = (id) => typeof id === "string" && mongoose2.isObjectIdOrHexString(id);
var text = (value, max) => typeof value === "string" && value.trim().length > 0 && value.trim().length <= max ? value.trim() : null;
var eventView = (event) => ({ id: event.id, title: event.title, type: event.type, category: event.category, description: event.description, startsAt: event.startsAt, venue: event.venue, host: event.host, feePaise: event.feePaise, cancelled: event.cancelled });
function addEventRoutes(app, { requireUser, route }) {
  const admin = (req, res, next) => req.user.role === "admin" ? next() : res.status(403).json({ error: "Only an admin can manage events." });
  const student = (req, res, next) => req.user.role === "student" ? next() : res.status(403).json({ error: "Use a student account to register." });
  async function upcoming(id) {
    return validId(id) ? CampusEvent.findOne({ _id: id, cancelled: false, startsAt: { $gt: /* @__PURE__ */ new Date() } }) : null;
  }
  app.get("/api/events", requireUser, route(async (req, res) => {
    const events = await CampusEvent.find().sort({ startsAt: 1 }).limit(500);
    res.json({ events: events.map(eventView) });
  }));
  app.post("/api/events", requireUser, admin, route(async (req, res) => {
    const title = text(req.body.title, 100), venue = text(req.body.venue, 120), host = text(req.body.host, 100), description = text(req.body.description, 2e3);
    const startsAt = new Date(typeof req.body.startsAt === "string" ? req.body.startsAt : "");
    const { type, category, feePaise } = req.body;
    if (!title || !venue || !host || !description || !["College", "Outside"].includes(type) || !["Technology", "Culture", "Workshop", "Sports", "Other"].includes(category) || !Number.isFinite(startsAt.getTime()) || startsAt <= /* @__PURE__ */ new Date() || !Number.isSafeInteger(feePaise) || feePaise < 0 || feePaise > 1e7) return res.status(400).json({ error: "Check all event fields, future date and test fee (\u20B90 to \u20B9100,000)." });
    const event = await CampusEvent.create({ title, venue, host, description, startsAt, type, category, feePaise, organizer: req.user.id });
    res.status(201).json({ event: eventView(event) });
  }));
  app.post("/api/events/:id/cancel", requireUser, admin, route(async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).json({ error: "Invalid event ID." });
    const event = await CampusEvent.findByIdAndUpdate(req.params.id, { cancelled: true }, { returnDocument: "after" });
    if (!event) return res.status(404).json({ error: "Event not found." });
    res.json({ event: eventView(event) });
  }));
  app.get("/api/events/:id/registrations", requireUser, admin, route(async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).json({ error: "Invalid event ID." });
    const event = await CampusEvent.findById(req.params.id);
    if (!event) return res.status(404).json({ error: "Event not found." });
    const rows = await Registration.find({ event: event.id }).populate("student", "name email studentId").sort({ createdAt: 1 });
    const registrations = rows.map((row) => ({ id: row.id, registeredAt: row.createdAt, checkedInAt: row.checkedInAt || null, student: row.student ? { name: row.student.name, email: row.student.email, studentId: row.student.studentId } : null }));
    res.json({ eventId: event.id, registrations, count: registrations.length });
  }));
  app.get("/api/registrations", requireUser, route(async (req, res) => {
    const registrations = await Registration.find({ student: req.user.id }).populate("event").sort({ createdAt: -1 });
    res.json({ registrations: registrations.filter((item2) => item2.event).map((item2) => ({ id: item2.id, event: eventView(item2.event), paymentMode: item2.paymentMode, createdAt: item2.createdAt })) });
  }));
  app.post("/api/events/:id/register", requireUser, student, route(async (req, res) => {
    const event = await upcoming(req.params.id);
    if (!event) return res.status(404).json({ error: "This event is unavailable or has started." });
    if (event.feePaise !== 0) return res.status(400).json({ error: "Use the clearly marked test checkout for this event." });
    const registration = await Registration.findOneAndUpdate({ student: req.user.id, event: event.id }, { $setOnInsert: { paymentMode: "free" } }, { upsert: true, returnDocument: "after", runValidators: true });
    res.json({ registrationId: registration.id });
  }));
  app.delete("/api/events/:id/registration", requireUser, student, route(async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).json({ error: "Invalid event ID." });
    await Registration.deleteOne({ student: req.user.id, event: req.params.id, checkedInAt: null });
    if (await Registration.exists({ student: req.user.id, event: req.params.id, checkedInAt: { $ne: null } })) return res.status(409).json({ error: "Entry has already been recorded. This registration cannot be removed." });
    res.json({ ok: true });
  }));
  app.post("/api/test-payments", requireUser, student, route(async (req, res) => {
    const event = await upcoming(req.body.eventId);
    if (!event) return res.status(404).json({ error: "This event is unavailable or has started." });
    if (event.feePaise === 0) return res.status(400).json({ error: "This is a free event. Register without checkout." });
    if (await Registration.exists({ student: req.user.id, event: event.id })) return res.status(409).json({ error: "You are already registered." });
    const payment = await TestPayment.create({ student: req.user.id, event: event.id, amountPaise: event.feePaise });
    res.status(201).json({ payment: { id: payment.id, amountPaise: payment.amountPaise, currency: "INR", status: payment.status, mode: "simulation" } });
  }));
  app.post("/api/test-payments/:id/complete", requireUser, student, route(async (req, res) => {
    if (!validId(req.params.id) || !["success", "failure", "cancelled"].includes(req.body.outcome)) return res.status(400).json({ error: "Choose a test checkout outcome." });
    let payment = await TestPayment.findOne({ _id: req.params.id, student: req.user.id });
    if (!payment) return res.status(404).json({ error: "Test payment not found." });
    if (!await upcoming(payment.event.toString())) return res.status(409).json({ error: "The event is no longer available. No registration was added." });
    if (payment.status === "pending") payment = await TestPayment.findOneAndUpdate({ _id: payment.id, student: req.user.id, status: "pending" }, { status: req.body.outcome }, { returnDocument: "after" }) || await TestPayment.findById(payment.id);
    if (payment.status === "success") await Registration.findOneAndUpdate({ student: req.user.id, event: payment.event }, { $setOnInsert: { paymentMode: "simulation" } }, { upsert: true, returnDocument: "after", runValidators: true });
    res.json({ payment: { id: payment.id, amountPaise: payment.amountPaise, currency: payment.currency, status: payment.status, mode: "simulation" } });
  }));
}

import mongoose3 from "mongoose";
import { randomBytes as randomBytes2 } from "node:crypto";
var validId2 = (id) => typeof id === "string" && mongoose3.isObjectIdOrHexString(id);
var validToken = (token) => typeof token === "string" && /^CC1\.[a-f0-9]{64}$/.test(token);
var ticketView = (row, event, student) => ({
  code: row.ticketToken,
  registrationId: row.id,
  event: { id: event.id, title: event.title, venue: event.venue, startsAt: event.startsAt, host: event.host },
  student: { name: student.name, studentId: student.studentId },
  paymentMode: row.paymentMode,
  checkedInAt: row.checkedInAt || null,
  issuedAt: row.createdAt
});
function addTicketRoutes(app, { requireUser, route }) {
  const admin = (req, res, next) => req.user.role === "admin" ? next() : res.status(403).json({ error: "Only an admin can validate entry tickets." });
  app.post("/api/events/:id/ticket", requireUser, route(async (req, res) => {
    if (req.user.role !== "student") return res.status(403).json({ error: "Use a student account to open your ticket." });
    if (!validId2(req.params.id)) return res.status(400).json({ error: "Invalid event ID." });
    const event = await CampusEvent.findOne({ _id: req.params.id, cancelled: false });
    if (!event) return res.status(404).json({ error: "This event is unavailable or cancelled." });
    const filter = { student: req.user.id, event: event.id };
    let row = await Registration.findOne(filter).select("+ticketToken");
    if (!row) return res.status(404).json({ error: "Register for this event before opening a ticket." });
    if (!row.ticketToken) {
      await Registration.updateOne({ ...filter, ticketToken: { $exists: false } }, { $set: { ticketToken: "CC1." + randomBytes2(32).toString("hex") } });
      row = await Registration.findOne(filter).select("+ticketToken");
    }
    if (!row) return res.status(409).json({ error: "Registration was removed. Refresh your dashboard." });
    res.json({ ticket: ticketView(row, event, req.user) });
  }));
  async function resolve(req, res) {
    const { code, eventId } = req.body;
    if (!validToken(code) || !validId2(eventId)) {
      res.status(400).json({ error: "Choose an event and scan or paste a complete CampusConnect entry code." });
      return null;
    }
    const event = await CampusEvent.findOne({ _id: eventId, cancelled: false });
    if (!event) {
      res.status(409).json({ error: "This event is cancelled or unavailable. Entry is not allowed." });
      return null;
    }
    const row = await Registration.findOne({ ticketToken: code }).select("+ticketToken").populate("student", "name studentId");
    if (!row || !row.student) {
      res.status(404).json({ error: "Ticket not found. It may be invalid or the registration was removed." });
      return null;
    }
    if (row.event.toString() !== event.id) {
      res.status(409).json({ error: "Wrong event. This ticket does not belong to the selected event." });
      return null;
    }
    return { row, event };
  }
  app.post("/api/tickets/verify", requireUser, admin, route(async (req, res) => {
    const result = await resolve(req, res);
    if (!result) return;
    const { row, event } = result;
    res.json({ ticket: ticketView(row, event, row.student), status: row.checkedInAt ? "already-entered" : "valid" });
  }));
  app.post("/api/tickets/check-in", requireUser, admin, route(async (req, res) => {
    const result = await resolve(req, res);
    if (!result) return;
    const { row, event } = result;
    const checked = await Registration.findOneAndUpdate({ _id: row.id, ticketToken: req.body.code, checkedInAt: null }, { $set: { checkedInAt: /* @__PURE__ */ new Date(), checkedInBy: req.user.id } }, { returnDocument: "after" }).select("+ticketToken");
    if (!checked) return res.status(409).json({ error: "This ticket has already been used, or its registration was removed. Scan again to check its status." });
    res.json({ ticket: ticketView(checked, event, row.student), status: "checked-in" });
  }));
}

import mongoose4 from "mongoose";
var oid = (id) => typeof id === "string" && mongoose4.isValidObjectId(id);
var item = (m) => ({ id: m.id, body: m.body, senderRole: m.senderRole, senderName: m.senderName, createdAt: m.createdAt, readAt: m.readAt });
function addMessageRoutes(app, { requireUser, route }) {
  async function studentFor(req, res) {
    const id = req.params.studentId;
    if (!oid(id)) {
      res.status(400).json({ error: "Invalid conversation." });
      return null;
    }
    if (req.user.role !== "admin" && req.user.id !== id) {
      res.status(403).json({ error: "This conversation is private to its student and the campus admin team." });
      return null;
    }
    const student = await User.findOne({ _id: id, role: "student" }).select("name studentId");
    if (!student) {
      res.status(404).json({ error: "Student conversation not found." });
      return null;
    }
    return student;
  }
  app.get("/api/messages", requireUser, route(async (req, res) => {
    if (req.user.role === "student") {
      const unread = await StudentMessage.countDocuments({ student: req.user._id, senderRole: "admin", readAt: null });
      return res.json({ threads: [{ studentId: req.user.id, name: req.user.name, studentCode: req.user.studentId, unread }] });
    }
    const grouped = await StudentMessage.aggregate([{ $sort: { createdAt: -1, _id: -1 } }, { $group: { _id: "$student", latest: { $first: "$body" }, updatedAt: { $first: "$createdAt" }, unread: { $sum: { $cond: [{ $and: [{ $eq: ["$senderRole", "student"] }, { $eq: [{ $ifNull: ["$readAt", null] }, null] }] }, 1, 0] } } } }, { $sort: { updatedAt: -1 } }, { $limit: 100 }]);
    const students = await User.find({ _id: { $in: grouped.map((g) => g._id) }, role: "student" }).select("name studentId");
    const byId = new Map(students.map((s) => [s.id, s]));
    res.json({ threads: grouped.filter((g) => byId.has(String(g._id))).map((g) => ({ studentId: String(g._id), name: byId.get(String(g._id)).name, studentCode: byId.get(String(g._id)).studentId, preview: g.latest.slice(0, 100), updatedAt: g.updatedAt, unread: g.unread })), limit: 100 });
  }));
  app.get("/api/messages/:studentId", requireUser, route(async (req, res) => {
    const student = await studentFor(req, res);
    if (!student) return;
    const before = req.query.before;
    if (before && !oid(before)) return res.status(400).json({ error: "Invalid page." });
    const messages = await StudentMessage.find({ student: student._id, ...before ? { _id: { $lt: before } } : {} }).sort({ _id: -1 }).limit(51);
    const hasOlder = messages.length > 50;
    const selected = messages.slice(0, 50).reverse();
    res.json({ student: { id: student.id, name: student.name, studentCode: student.studentId }, messages: selected.map(item), hasOlder, nextBefore: hasOlder ? selected[0].id : null });
  }));
  app.post("/api/messages/:studentId", requireUser, route(async (req, res) => {
    const student = await studentFor(req, res);
    if (!student) return;
    const body = typeof req.body.body === "string" ? req.body.body.trim() : "";
    const clientId = req.body.clientId;
    if (!body || body.length > 2e3 || typeof clientId !== "string" || !/^[a-f0-9-]{36}$/i.test(clientId)) return res.status(400).json({ error: "Write a message of 1 to 2,000 characters." });
    const existing = await StudentMessage.findOne({ sender: req.user._id, clientId });
    if (existing) {
      if (existing.student.toString() !== student.id || existing.body !== body) return res.status(409).json({ error: "Retry token already used." });
      return res.json({ message: item(existing) });
    }
    let m;
    try {
      m = await StudentMessage.create({ student: student._id, sender: req.user._id, senderName: req.user.name, senderRole: req.user.role, body, clientId });
    } catch (e) {
      if (e.code !== 11e3) throw e;
      m = await StudentMessage.findOne({ sender: req.user._id, clientId });
      if (!m || m.student.toString() !== student.id || m.body !== body) return res.status(409).json({ error: "Retry token already used." });
    }
    res.status(201).json({ message: item(m) });
  }));
  app.post("/api/messages/:studentId/read", requireUser, route(async (req, res) => {
    const student = await studentFor(req, res);
    if (!student) return;
    const ids = req.body.ids;
    if (!Array.isArray(ids) || ids.length > 50 || !ids.every(oid)) return res.status(400).json({ error: "Invalid message list." });
    await StudentMessage.updateMany({ student: student._id, _id: { $in: ids }, senderRole: req.user.role === "admin" ? "student" : "admin", readAt: null }, { $set: { readAt: /* @__PURE__ */ new Date() } });
    res.json({ ok: true });
  }));
}

var publicUser = (user) => ({ id: user.id, studentId: user.studentId, name: user.name, email: user.email, role: user.role, course: user.course, year: user.year, bio: user.bio });
var text2 = (value, max) => typeof value === "string" && value.trim().length <= max ? value.trim() : null;
var validEmail = (email) => email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
var regenerate = (req) => new Promise((resolve, reject) => req.session.regenerate((error) => error ? reject(error) : resolve()));
var saveSession = (req) => new Promise((resolve, reject) => req.session.save((error) => error ? reject(error) : resolve()));
function createApp({ mongoUrl: mongoUrl2, secret, staticDirectory, disableRateLimit = false }) {
  const app = express();
  app.disable("x-powered-by");
  app.use((req, res, next) => /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.get("host") || "") ? next() : res.status(403).json({ error: "Open this app through localhost." }));
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(express.json({ limit: "16kb" }));
  const store = MongoStore.create({ mongoUrl: mongoUrl2, collectionName: "sessions", ttl: 60 * 60 * 8 });
  app.use(session({ name: "campus.sid", secret, store, resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: "strict", secure: false, maxAge: 8 * 60 * 60 * 1e3 } }));
  if (!disableRateLimit) app.use("/api", rateLimit({ windowMs: 60 * 1e3, limit: 180, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Too many requests. Wait a minute and try again." } }));
  app.use("/api", (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    if (!req.is("application/json")) return res.status(415).json({ error: "Send JSON data." });
    const origin = req.get("Origin");
    if (origin && origin !== `${req.protocol}://${req.get("host")}`) return res.status(403).json({ error: "Request origin was not accepted." });
    const supplied = req.get("X-CSRF-Token");
    const expected = req.session.csrf;
    if (typeof supplied !== "string" || !/^[a-f0-9]{64}$/.test(supplied) || !expected || supplied.length !== expected.length || !timingSafeEqual2(Buffer.from(supplied), Buffer.from(expected))) return res.status(403).json({ error: "Refresh the page and try again." });
    next();
  });
  if (!disableRateLimit) app.use("/api/auth", rateLimit({ windowMs: 15 * 60 * 1e3, limit: 40, standardHeaders: "draft-7", legacyHeaders: false, message: { error: "Too many account attempts. Try again in 15 minutes." } }));
  const route = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  app.get("/api/session", route(async (req, res) => {
    if (!req.session.csrf) req.session.csrf = randomBytes3(32).toString("hex");
    const user = req.session.userId ? await User.findById(req.session.userId) : null;
    if (req.session.userId && !user) delete req.session.userId;
    res.json({ user: user ? publicUser(user) : null, csrf: req.session.csrf });
  }));
  app.post("/api/auth/signup", route(async (req, res) => {
    const name = text2(req.body.name, 60);
    const email = text2(req.body.email, 254)?.toLowerCase();
    const password = req.body.password;
    if (!name || !validEmail(email) || typeof password !== "string" || password.length < 12 || password.length > 128) return res.status(400).json({ error: "Enter a name, valid email, and a password of 12 to 128 characters." });
    const passwordHash = await hashPassword(password);
    let user;
    try {
      user = await User.create({ name, email, passwordHash });
    } catch (error) {
      if (error.code === 11e3) return res.status(409).json({ error: "An account already uses that email. Sign in instead." });
      throw error;
    }
    await regenerate(req);
    req.session.userId = user.id;
    req.session.csrf = randomBytes3(32).toString("hex");
    await saveSession(req);
    res.status(201).json({ user: publicUser(user), csrf: req.session.csrf });
  }));
  app.post("/api/auth/login", route(async (req, res) => {
    const email = text2(req.body.email, 254)?.toLowerCase();
    const password = req.body.password;
    if (!validEmail(email) || typeof password !== "string" || password.length > 128) return res.status(400).json({ error: "Enter your email and password." });
    const user = await User.findOne({ email }).select("+passwordHash");
    if (!user || !await verifyPassword(user.passwordHash, password)) return res.status(401).json({ error: "Email or password is incorrect." });
    await regenerate(req);
    req.session.userId = user.id;
    req.session.csrf = randomBytes3(32).toString("hex");
    await saveSession(req);
    res.json({ user: publicUser(user), csrf: req.session.csrf });
  }));
  app.post("/api/auth/logout", route(async (req, res) => {
    await new Promise((resolve, reject) => req.session.destroy((error) => error ? reject(error) : resolve()));
    res.clearCookie("campus.sid", { httpOnly: true, sameSite: "strict", secure: false, path: "/" });
    res.json({ ok: true });
  }));
  const requireUser = route(async (req, res, next) => {
    const user = req.session.userId ? await User.findById(req.session.userId) : null;
    if (!user) return res.status(401).json({ error: "Sign in to continue." });
    req.user = user;
    next();
  });
  app.patch("/api/profile", requireUser, route(async (req, res) => {
    const name = text2(req.body.name, 60);
    const course = text2(req.body.course, 40);
    const bio = text2(req.body.bio, 200);
    if (!name || course === null || bio === null || !["", "First year", "Second year", "Third year", "Fourth year"].includes(req.body.year)) return res.status(400).json({ error: "Check your profile fields." });
    Object.assign(req.user, { name, course, bio, year: req.body.year });
    await req.user.save();
    res.json({ user: publicUser(req.user) });
  }));
  addEventRoutes(app, { requireUser, route });
  addNotificationRoutes(app, { requireUser, route });
  addTicketRoutes(app, { requireUser, route });
  addMessageRoutes(app, { requireUser, route });
  app.use("/api", (req, res) => res.status(404).json({ error: "API route not found." }));
  if (staticDirectory) app.use(express.static(staticDirectory));
  app.use((error, req, res, next) => {
    if (error instanceof SyntaxError) return res.status(400).json({ error: "Invalid request data." });
    console.error("Request failed:", error.name);
    res.status(500).json({ error: "The server could not complete this request. Check the terminal." });
  });
  return { app, store, requireUser, route, publicUser };
}

var here = path.dirname(fileURLToPath(import.meta.url));
var mongoUrl = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/campus_event_management";
var port = Number(process.env.PORT || 3001);
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("PORT must be an integer between 1024 and 65535.");
try {
  await mongoose5.connect(mongoUrl, { serverSelectionTimeoutMS: 5e3 });
  await Promise.all([User.init(), CampusEvent.init(), Registration.init(), TestPayment.init(), NotificationRead.init(), StudentMessage.init()]);
  if (process.argv[2] === "--make-admin") {
    const email = process.argv[3]?.trim().toLowerCase();
    if (!email || process.argv.length !== 4) throw new Error("Usage: npm start -- --make-admin account-email");
    const account = await User.findOneAndUpdate({ email }, { role: "admin" }, { returnDocument: "after" });
    if (!account) {
      console.error("No existing account matches that email. Sign up in the app first. Nothing was changed.");
      await mongoose5.disconnect();
      process.exit(1);
    }
    console.log(`Admin role assigned to existing account: ${account.email}. Sign out and sign in again.`);
    await mongoose5.disconnect();
    process.exit(0);
  }
  if (process.argv[2] === "--check") {
    console.log("MongoDB connected. Backend dependencies loaded. No account or event was created.");
    await mongoose5.disconnect();
    process.exit(0);
  }
  const { app, store } = createApp({ mongoUrl, secret: randomBytes4(48).toString("hex"), staticDirectory: path.join(here, "..", "dist") });
  const server = app.listen(port, "127.0.0.1", () => console.log(`Campus app running: http://127.0.0.1:${port}
MongoDB connected. Server restart requires signing in again. Keep this terminal open. Press Ctrl+C to stop.`));
  server.on("error", (error) => {
    console.error(error.code === "EADDRINUSE" ? `Port ${port} is already in use. Stop the earlier Campus server before starting another.` : "Could not start the server.");
    process.exit(1);
  });
  async function close() {
    server.close();
    await store.close();
    await mongoose5.disconnect();
    process.exit(0);
  }
  process.on("SIGINT", close);
  process.on("SIGTERM", close);
} catch (error) {
  console.error(error.name === "MongooseServerSelectionError" ? "Cannot connect to local MongoDB. Check that the MongoDB Windows service is running, then try again. No reinstall is needed." : `Server could not start (${error.name}).`);
  process.exit(1);
}
