const express = require("express");
const { bulkInsertHandler, deleteCollectionHandler } = require("../controllers/dbController");
const roleMiddleware = require("@middlewares/roleMiddleware");
const auth = require("@middlewares/authMiddleware");
const router = express.Router();

router.use(auth);
router.post("/bulk-insert", roleMiddleware(["admin"]), bulkInsertHandler);
router.post("/delete-collection", roleMiddleware(["admin"]), deleteCollectionHandler);

module.exports = router;
