const isDev = ["dev", "mobileapps"].includes(process.env.NODE_ENV);

const PROD_ORIGINS = [
  "https://boilerplate.com",
  "https://www.boilerplate.com",
  "https://dev.boilerplate.com",
  "https://www.dev.boilerplate.com",
  "http://localhost:4003",
  "https://boilerplate.vercel.app",
  "http://192.168.13.67:4003"
];

module.exports = {
  isDev,
  allowedOrigins: isDev ? [] : PROD_ORIGINS,
  connectSrc: isDev ? ["*"] : ["'self'", ...PROD_ORIGINS],
};