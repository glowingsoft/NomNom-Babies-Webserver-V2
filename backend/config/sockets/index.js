const { attachRedisAdapter } = require("./socketRedisAdapter");
const { orderSocketHandler } = require("./orders/orderSocketHandler");

function initializeSockets(io) {
  attachRedisAdapter(io);

  console.log("🚀 Order sockets initialized");
}

module.exports = { initializeSockets };
