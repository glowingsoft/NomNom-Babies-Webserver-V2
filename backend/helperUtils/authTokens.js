// Sessions: short-lived access JWTs + rotating, single-use refresh tokens (stored hashed in AuthSession).
//
// - Access token: HS256 JWT { _id, sid, typ: "access" }, valid ACCESS_TOKEN_TTL_SECONDS (15 min). Sent as
//   "Authorization: Bearer …"; the auth middleware also checks that its session (sid) hasn't been revoked.
// - Refresh token: 256-bit random, single use. POST /api/auth/refresh swaps it for a new access + refresh pair.
//   Using an already-used token again normally means it was copied, so the whole sign-in is revoked. Two
//   exceptions keep real users signed in: a duplicate within a few seconds (two tabs / a retry) gets 409, and
//   if the swap's reply never arrived (the token it issued was never used) the old token may swap once more.
// - Mobile apps get the refresh token in the response body (they keep it in the Keychain/Keystore); web
//   clients (admin panel) get it as an httpOnly cookie limited to /api/auth, so page scripts can't read it.
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const NodeCache = require("node-cache");
const AuthSession = require("@models/AuthSession");

const ACCESS_TTL_SECONDS = Number(process.env.ACCESS_TOKEN_TTL_SECONDS) || 15 * 60;
// A sign-in stays alive while the app is opened at least every REFRESH_TOKEN_TTL_DAYS. SESSION_MAX_DAYS adds a
// hard limit (0 / unset = none: users stay signed in until they log out, like Instagram).
const REFRESH_TTL_MS = (Number(process.env.REFRESH_TOKEN_TTL_DAYS) || 180) * 864e5;
const SESSION_MAX_MS = (Number(process.env.SESSION_MAX_DAYS) || 36500) * 864e5;
// Duplicate swaps within this window are concurrent requests (answered 409, nothing revoked).
const REUSE_GRACE_MS = 5 * 1000;
// A swap whose reply was lost (its new token never used) can be retried with the old token for this long.
const LOST_REPLY_MS = 10 * 60 * 1000;
const COOKIE = "nn_rt";
const COOKIE_PATH = "/api/auth";
const WEB_DEVICE_TYPES = ["desktop", "web"];

// Session liveness, cached briefly so revoked sessions stop working within seconds without a DB hit per request.
const sessionCache = new NodeCache({ stdTTL: 30, checkperiod: 60 });

const hash = (token) => crypto.createHash("sha256").update(token).digest("hex");
const newRefreshToken = () => crypto.randomBytes(32).toString("base64url");

const signAccessToken = (userId, sid) =>
  jwt.sign({ _id: String(userId), sid, typ: "access" }, process.env.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: ACCESS_TTL_SECONDS,
  });

/** Verifies an access token (signature, expiry, type). Other tokens signed with the secret are rejected. */
const verifyAccessToken = (token) => {
  const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
  if (decoded.typ !== "access" || !decoded.sid || !decoded._id) {
    const error = new Error("Not an access token");
    error.name = "JsonWebTokenError";
    throw error;
  }
  return decoded;
};

const isSessionActive = async (sid) => {
  const cached = sessionCache.get(sid);
  if (cached !== undefined) return cached;
  const active = Boolean(
    await AuthSession.exists({
      family: sid,
      revokedAt: null,
      familyExpiresAt: { $gt: new Date() },
    }),
  );
  sessionCache.set(sid, active);
  return active;
};

const isWebClient = (req) =>
  WEB_DEVICE_TYPES.includes(String(req.body?.deviceType || "").toLowerCase()) ||
  String(req.get("X-Client") || "").toLowerCase() === "web";

const readCookie = (req, name) => {
  const pair = String(req.headers.cookie || "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`));
  return pair ? decodeURIComponent(pair.slice(name.length + 1)) : "";
};

const cookieOptions = (expires) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "prod",
  sameSite: "strict",
  path: COOKIE_PATH,
  expires,
});

const clearRefreshCookie = (res) =>
  res.clearCookie(COOKIE, { ...cookieOptions(), expires: undefined });

/** Stores a new refresh row and hands the token to the client (cookie for web, body for apps). */
const issueRefreshToken = async (req, res, { user, family, familyExpiresAt, deviceId, deviceType, parent = null }) => {
  const token = newRefreshToken();
  const now = Date.now();
  const expiresAt = new Date(Math.min(now + REFRESH_TTL_MS, familyExpiresAt.getTime()));
  await AuthSession.create({
    user,
    family,
    parent,
    tokenHash: hash(token),
    deviceId,
    deviceType,
    userAgent: String(req.get("user-agent") || "").slice(0, 300),
    ip: req.ip,
    expiresAt,
    familyExpiresAt,
  });
  const web = isWebClient(req) || WEB_DEVICE_TYPES.includes(deviceType);
  if (web) res.cookie(COOKIE, token, cookieOptions(expiresAt));
  // Merged into the JSON response by attachSessionToResponse (auth routes).
  res.locals.authBody = {
    accessTokenExpiresIn: ACCESS_TTL_SECONDS,
    ...(web ? {} : { refreshToken: token, refreshTokenExpiresAt: expiresAt }),
  };
};

/** Starts a new sign-in for `user`; returns the access token (refresh token goes out via cookie/body). */
const startSession = async (user, req, res) => {
  const family = crypto.randomUUID();
  await issueRefreshToken(req, res, {
    user: user._id,
    family,
    familyExpiresAt: new Date(Date.now() + SESSION_MAX_MS),
    deviceId: String(req.body?.deviceId || "").slice(0, 200),
    deviceType: String(req.body?.deviceType || "").toLowerCase().slice(0, 30),
  });
  sessionCache.set(family, true);
  return signAccessToken(user._id, family);
};

const revokeFamily = async (family, reason) => {
  if (!family) return;
  await AuthSession.updateMany(
    { family, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
  sessionCache.set(family, false);
};

/** Ends every sign-in of a user (optionally keeping one, e.g. the device that just changed the password). */
const revokeUserSessions = async (userId, { except, reason = "revoked" } = {}) => {
  const families = await AuthSession.distinct("family", {
    user: userId,
    revokedAt: null,
    ...(except ? { family: { $ne: except } } : {}),
  });
  await AuthSession.updateMany(
    { user: userId, revokedAt: null, ...(except ? { family: { $ne: except } } : {}) },
    { $set: { revokedAt: new Date(), revokedReason: reason } },
  );
  families.forEach((f) => sessionCache.set(f, false));
  return families.length;
};

/**
 * Swaps a refresh token for a new access + refresh pair.
 * Returns { accessToken } or { error: { status, key } }; `onReuse` is called when theft is detected.
 */
const rotateRefreshToken = async (req, res, { onReuse, loadUser }) => {
  const presented = String(req.body?.refreshToken || readCookie(req, COOKIE) || "");
  if (!presented) return { error: { status: 401, key: "refresh_token_missing" } };

  const row = await AuthSession.findOne({ tokenHash: hash(presented) });
  const now = Date.now();
  if (!row) return { error: { status: 401, key: "invalid_refresh_token" } };
  if (row.revokedAt || row.familyExpiresAt.getTime() <= now)
    return { error: { status: 401, key: "session_expired" } };

  let recovering = null;
  if (row.usedAt) {
    const since = now - row.usedAt.getTime();
    // A duplicate of a swap that just happened (second tab, simultaneous retry): not theft.
    if (since < REUSE_GRACE_MS)
      return { error: { status: 409, key: "refresh_in_progress" } };
    // The swap went through but its reply never reached the client (dropped connection): the token it
    // issued has never been used, so let the old token swap once more and retire that unused one.
    const successor = await AuthSession.findOne({ parent: row._id }).sort({ createdAt: -1 });
    if (successor && !successor.usedAt && !successor.revokedAt && since < LOST_REPLY_MS) {
      recovering = successor;
    } else {
      // The newer token was already in use, so this old one is a copy: end the sign-in everywhere.
      await revokeFamily(row.family, "refresh_token_reuse");
      if (onReuse) await onReuse(row);
      return { error: { status: 401, key: "session_revoked" } };
    }
  }
  if (row.expiresAt.getTime() <= now) {
    await revokeFamily(row.family, "idle_timeout");
    return { error: { status: 401, key: "session_expired" } };
  }

  const user = await loadUser(row.user);
  if (!user) {
    await revokeFamily(row.family, "account_unavailable");
    return { error: { status: 401, key: "session_expired" } };
  }

  if (recovering) {
    // Retire the undelivered token atomically (only if it is still unused).
    const retired = await AuthSession.updateOne(
      { _id: recovering._id, usedAt: null, revokedAt: null },
      { $set: { usedAt: new Date(now), revokedAt: new Date(now), revokedReason: "reply_lost" } },
    );
    if (!retired.modifiedCount) return { error: { status: 409, key: "refresh_in_progress" } };
    await AuthSession.updateOne({ _id: row._id }, { $set: { usedAt: new Date(now) } });
  } else {
    // Claim the token atomically so two simultaneous swaps can't both succeed.
    const claimed = await AuthSession.updateOne(
      { _id: row._id, usedAt: null },
      { $set: { usedAt: new Date(now) } },
    );
    if (!claimed.modifiedCount) return { error: { status: 409, key: "refresh_in_progress" } };
  }

  await issueRefreshToken(req, res, {
    user: row.user,
    family: row.family,
    familyExpiresAt: row.familyExpiresAt,
    deviceId: row.deviceId,
    deviceType: row.deviceType,
    parent: row._id,
  });
  return { accessToken: signAccessToken(row.user, row.family), userId: row.user };
};

/** Express middleware for auth routes: adds res.locals.authBody (refresh token etc.) to `data` of JSON replies. */
const attachSessionToResponse = (req, res, next) => {
  const json = res.json.bind(res);
  res.json = (body) => {
    if (res.locals.authBody && body && typeof body === "object") {
      body.data = { ...(body.data || {}), ...res.locals.authBody };
    }
    return json(body);
  };
  next();
};

module.exports = {
  ACCESS_TTL_SECONDS,
  startSession,
  verifyAccessToken,
  isSessionActive,
  rotateRefreshToken,
  revokeFamily,
  revokeUserSessions,
  clearRefreshCookie,
  attachSessionToResponse,
};
