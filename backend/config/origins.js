const isDev = ["dev", "mobileapps"].includes(process.env.NODE_ENV);

// Web origins allowed to call the API with credentials (admin panel / website). Native apps send no Origin.
const WEB_ORIGINS = (
  process.env.WEB_ORIGINS || "https://www.nomnombabies.com,https://nomnombabies.com"
)
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

// Local development: localhost, the Android emulator host and LAN addresses only.
const DEV_ORIGIN = /^https?:\/\/(localhost|127\.0\.0\.1|10\.0\.2\.2|192\.168\.\d+\.\d+)(:\d+)?$/;

const isAllowedOrigin = (origin) =>
  !origin || WEB_ORIGINS.includes(origin) || (isDev && DEV_ORIGIN.test(origin));

module.exports = {
  isDev,
  allowedOrigins: WEB_ORIGINS,
  isAllowedOrigin,
  connectSrc: isDev ? ["*"] : ["'self'", ...WEB_ORIGINS],
};
