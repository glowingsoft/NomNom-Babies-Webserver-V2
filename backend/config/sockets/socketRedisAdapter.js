const { createNewRedisClient, isRedisUp } = require("../redis/redisConfig");

/**
 * Attaches Redis adapter to a Socket.IO server instance.
 *
 * This creates:
 * - One Redis connection for publishing events
 * - One Redis connection for subscribing to events
 *
 * These connections:
 * - Are ephemeral
 * - Do NOT store data
 * - Do NOT create keys
 * - Act purely as a message relay (pub/sub)
 *
 * @param {import("socket.io").Server} io
 */
function attachRedisAdapter(io) {
  if (!isRedisUp()) {
    console.log("🔌 Socket.IO Redis adapter disabled");
    return;
  }

  const { createAdapter } = require("@socket.io/redis-adapter");

  const pubClient = createNewRedisClient();

  const subClient = createNewRedisClient();

  io.adapter(createAdapter(pubClient, subClient));

  console.log("🔗 Socket.IO Redis adapter attached");
}

module.exports = { attachRedisAdapter };
