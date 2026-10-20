const NodeCache = require("node-cache");

const nodeCache = new NodeCache({ stdTTL: 0, checkperiod: 0 });

const userCache = new NodeCache({ stdTTL: 3600, checkperiod: 120 });

module.exports = { nodeCache, userCache };
