const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const hpp = require("hpp");
const cors = require("cors");
const compression = require("compression");
const express = require("express");
const { isDev, connectSrc } = require("@config/origins");
const securityMiddleware = (app, options = {}) => {
  const {
    allowedOrigins = [],
    adminIPWhitelist = [],
    maxRequestSize = "10mb",
    rateLimitWindow = 15 * 60 * 1000,
    rateLimitMax = 1000,
  } = options;

  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'", "'unsafe-inline'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:"],
          connectSrc,
        },
      },
      referrerPolicy: { policy: "no-referrer" },
      crossOriginEmbedderPolicy: true,
      crossOriginOpenerPolicy: { policy: "same-origin" },
      crossOriginResourcePolicy: { policy: "same-origin" },
      hsts: { maxAge: 31536000, includeSubDomains: true },
    })
  );

  app.use(hpp());

  app.use(compression());

  const limiter = rateLimit({
    windowMs: rateLimitWindow,
    max: rateLimitMax,
    skip: (req) => req.method === "OPTIONS" || req.path.startsWith("/api/media/"),
    message: {
      status: 429,
      message: "Too many requests from this IP, please try again later",
    },
  });
  app.use(limiter);

  app.use(express.json({ limit: maxRequestSize }));
  app.use(express.urlencoded({ extended: true, limit: maxRequestSize }));

  const corsOptions = {
    origin: function (origin, callback) {
      if (!origin) return callback(null, true);

      if (isDev) {
        return callback(null, true);
      }

      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS Forbidden"), false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-admin-access-token"],
  };

  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));

  app.use((err, req, res, next) => {
    if (err && err.message === "CORS Forbidden") {
      return res.status(403).json({ message: "CORS Forbidden" });
    }
    next();
  });

  if (adminIPWhitelist.length > 0) {
    app.use("/api/admin", (req, res, next) => {
      const clientIP =
        req.headers["x-forwarded-for"]?.split(",")[0] || req.connection.remoteAddress;
      if (!adminIPWhitelist.includes(clientIP)) {
        return res.status(403).json({ message: "Access denied for this IP" });
      }
      next();
    });
  }

  app.use((req, res, next) => {
    if (!req.ip || !req.method || !req.path) {
      console.warn("Suspicious request detected:", req.ip, req.method, req.path);
    }
    next();
  });
};

module.exports = { securityMiddleware };
