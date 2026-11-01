const redisEnabled = process.env.USE_REDIS === "true";

let Redis = null;

function getRedisConstructor() {
  if (!Redis) {
    Redis = require("ioredis");
  }

  return Redis;
}

let redisClient = null;
let redisAvailable = false;

function getRedisClient() {
  if (!redisEnabled) return null;

  if (redisClient) return redisClient;

  const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  const isAzure = url.startsWith("rediss://");
  const RedisClient = getRedisConstructor();

  redisClient = new RedisClient(url, {
    connectTimeout: 10000,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,

    retryStrategy(times) {
      return Math.min(times * 500, 5000);
    },

    reconnectOnError() {
      return true;
    },

    ...(isAzure && {
      tls: {
        rejectUnauthorized: false,
      },
    }),
  });

  redisClient.on("connect", () => {
    redisAvailable = true;
    console.log("🚀 Redis connected:", isAzure ? "Azure" : "Local");
  });

  redisClient.on("error", (error) => {
    console.log("⚠️ Redis connection error", error);
    redisAvailable = false;
  });

  return redisClient;
}

function createNewRedisClient() {
  if (!redisEnabled) return null;

  const url = process.env.REDIS_URL || "redis://127.0.0.1:6379";
  const isAzure = url.startsWith("rediss://");
  const RedisClient = getRedisConstructor();

  return new RedisClient(url, {
    connectTimeout: 10000,
    maxRetriesPerRequest: null,
    enableReadyCheck: true,

    retryStrategy(times) {
      return Math.min(times * 500, 5000);
  },

    reconnectOnError() {
      return true;
    },

    ...(isAzure && {
      tls: {
        rejectUnauthorized: false,
      },
    }),
  });
}

function isRedisUp() {
  return redisEnabled && redisAvailable;
}

module.exports = {
  getRedisClient,
  createNewRedisClient,
  isRedisUp,
};
