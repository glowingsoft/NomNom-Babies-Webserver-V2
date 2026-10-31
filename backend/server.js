require("../backend/config/logging");
const {
  logger,
  crashLogger,
  accessLogger,
} = require("../backend/config/logging");

const cors = require("cors");

global.logger = logger;

require("dotenv").config({
  path: `.env.${process.env.NODE_ENV || "dev"}`,
});

require("express-async-errors");
const express = require("express");
const morgan = require("morgan");
const path = require("path");
const moduleAlias = require("module-alias");

const aliases = require("../aliasConfig/pathAliases.config");
for (const [alias, target] of Object.entries(aliases)) {
  moduleAlias.addAlias(alias, path.join(__dirname, "..", target));
}
require("module-alias/register");

const { i18nConfig } = require("@config/i18nConfig");
const { securityMiddleware } = require("@middlewares/security");
const { initTextModeration } = require("@services/moderation/textModeration");
const {
  textModerationMiddleware,
} = require("@services/moderation/textModeration");

const { sendResponse } = require("@utils/responseUtil");

const connectToDB = require("@utils/server-setup");
const { backupMongoDB } = require("@utils/dataBaseBackup");
const { startCrons } = require("@config/cron");

const { createSocketServer } = require("@socketIo/socketServer");

const swaggerUi = require("swagger-ui-express");
const fs = require("fs");

const swaggerDir = path.join(__dirname, "..", "swagger");
const swaggerFilePath = path.join(swaggerDir, "swagger_output.json");

if (!fs.existsSync(swaggerDir)) {
  fs.mkdirSync(swaggerDir, { recursive: true });
}

if (!fs.existsSync(swaggerFilePath)) {
  const defaultSwagger = {
    openapi: "3.0.0",
    info: {
      title: "MERN Boilerplate API",
      description: "API documentation for MERN Boilerplate",
      version: "1.0.0",
    },
    servers: [
      { url: "http://localhost:4001/api", description: "Development server" },
    ],
    paths: {},
    components: {
      securitySchemes: {
        bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
      },
    },
  };
  fs.writeFileSync(swaggerFilePath, JSON.stringify(defaultSwagger, null, 2));
}

const swaggerFile = require("../swagger/swagger_output.json");
const { allowedOrigins } = require("@config/origins");

const app = express();
app.set("trust proxy", 1);

app.get("/", (req, res) => {
  res.send(
    '<!doctype html><html><head><title>NomNom Babies</title>' +
      '<link rel="icon" type="image/png" href="/favicon.png"></head>' +
      "<body>Hello from Node.js!</body></html>"
  );
});
["favicon.ico", "favicon.png"].forEach((file) => {
  app.get(`/${file}`, (req, res) => {
    const dir = path.join(__dirname, "assets", "favicon");
    const filePath = [file, "favicon.png"]
      .map((f) => path.join(dir, f))
      .find((p) => fs.existsSync(p));
    if (filePath) {
      res.set("Cache-Control", "public, max-age=86400");
      return res.sendFile(filePath);
    }
    res.status(204).end();
  });
});

app.get("/api", (req, res) => {
  res.json({
    name: "Project API",
    version: "v1",
    status: "running",
  });
});

app.get("/health", (req, res) => {
  res.status(200).json({
    status: "ok",
    uptime: process.uptime(),
  });
});

securityMiddleware(app, {
  allowedOrigins,
  adminIPWhitelist: [],
  maxRequestSize: "10mb",
  rateLimitWindow: 15 * 60 * 1000,
  rateLimitMax: 1000,
});

app.use(cors());

app.use(i18nConfig.init);

app.use(accessLogger);

if (process.env.NODE_ENV !== "prod") {
  app.use(morgan("dev"));
}

app.use(express.json());
app.use(textModerationMiddleware);

const routes = require("./commonModules/routes");
const adminRoutes = require("./admin/routes");
const appRoutes = require("./app/routes");

// Generated PDFs are linked under /api so they reach this server behind the website's reverse proxy.
app.use("/api/uploads", express.static(path.join(process.cwd(), "uploads")));
app.use("/api/app", appRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api", routes);
app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerFile));

app.use((req, res) => {
  sendResponse({
    res,
    statusCode: 404,
    translationKey: "route_not_found",
  });
});

app.use((err, req, res, next) => {
  logger.error("Request error", {
    method: req.method,
    path: req.originalUrl,
    error: err.message,
    stack: err.stack,
  });

  res.status(500).json({
    message: "Internal server error",
  });
});

const server = createSocketServer(app, allowedOrigins);

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  logger.info("HTTP server listening", {
    port: PORT,
    env: process.env.NODE_ENV,
  });
});

(async () => {
  try {
    await connectToDB();
    await initTextModeration();
    startCrons();

    setInterval(backupMongoDB, 24 * 60 * 60 * 1000);
  } catch (err) {
    logger.fatal("Startup failure", {
      error: err.message,
      stack: err.stack,
    });
  }
})();

const shutdown = async (signal) => {
  logger.warn("Shutdown signal received", { signal });

  try {
    if (global.io) {
      await global.io.close();
      logger.info("Socket.IO closed");
    }
    process.exit(0);
  } catch (err) {
    logger.error("Error during graceful shutdown", {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  }
};

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

process.on("unhandledRejection", (reason, promise) => {
  crashLogger.fatal("Unhandled Promise Rejection", {
    reason: reason?.message || reason,
    stack: reason?.stack,
  });

  setTimeout(() => {
    process.exit(1);
  }, 100);
});

process.on("uncaughtException", (err) => {
  crashLogger.fatal("Uncaught Exception", {
    error: err.message,
    stack: err.stack,
  });

  setTimeout(() => {
    process.exit(1);
  }, 100);
});
