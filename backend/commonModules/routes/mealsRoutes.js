const express = require("express");
const auth = require("../../middlewares/authMiddleware");
const createRateLimiter = require("@utils/rateLimiter");

const {
  adminGetMeals,
  createMeal,
  updateMeal,
  deleteMeal,
} = require("../controllers/MealsController");
const roleMiddleware = require("../../middlewares/roleMiddleware");

const router = express.Router();

const createMealsRateLimiter = createRateLimiter("createMeals", 15, 15);
const updateMealsRateLimiter = createRateLimiter("updateMeals", 15, 15);
const deleteMealsRateLimiter = createRateLimiter("deleteMeals", 15, 15);

// CONTENT ADMIN
router.post(
  "/admin",
  auth,
  roleMiddleware(["admin"]),
  createMealsRateLimiter,
  createMeal,
);
router.get("/admin/all", auth, roleMiddleware(["admin"]), adminGetMeals);
router.put(
  "/admin/:id",
  auth,
  roleMiddleware(["admin"]),
  updateMealsRateLimiter,
  updateMeal,
);
router.delete(
  "/admin/:id",
  auth,
  roleMiddleware(["admin"]),
  deleteMealsRateLimiter,
  deleteMeal,
);

module.exports = router;
