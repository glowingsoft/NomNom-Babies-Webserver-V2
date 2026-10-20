const express = require("express");
const auth = require("@middlewares/authMiddleware");

const {
  blockUser,
  reportUser,
  addOrUpdateSubscription,
  removeSubscription,
  getSubscriptions,
  getUserProfile,
  updateUserProfile,
  getOtherUserProfile,
} = require("../controllers/userController");
const roleMiddleware = require("@middlewares/roleMiddleware");
const router = express.Router();

router.use(auth);

router.get("/profile", (req, res, next) => {
  getUserProfile(req, res, next);
});

router.get("/profile/:userId", (req, res, next) => {
  getOtherUserProfile(req, res, next);
});

router.put("/profile", updateUserProfile)
router.post("/:userIdToBlock/block", blockUser);
router.post("/:userIdToReport/report", reportUser);
router.post("/add-update-subscription", addOrUpdateSubscription);
router.post("/remove-subscription/:subscriptionId", removeSubscription);
router.get("/subscriptions", getSubscriptions);

module.exports = router;
