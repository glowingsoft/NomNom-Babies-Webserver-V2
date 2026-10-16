const express = require("express");

const auth = require("../../middlewares/authMiddleware");

const {
  getFeedingTimetable,
  getTimetables,
  getTimetableDetail,
  deleteTimetable,
} = require("../controllers/feedingTimeTableController");

const router = express.Router();

router.get(
  "/",

  auth,

  getFeedingTimetable,
);

router.get("/timetables", auth, getTimetables);

router.get("/timetables/detail", auth, getTimetableDetail);

router.delete("/timetables", auth, deleteTimetable);

module.exports = router;
