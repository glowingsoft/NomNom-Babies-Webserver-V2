const Baby = require("@models/Baby");
const FeedingSchedule = require("@models/FeedingSchedule");
const FeedingLog = require("@models/FeedingLog");
const { User } = require("@models/UserModel");
const {
  sendResponse,
  parsePaginationParams,
  generateMeta,
  validateParams,
} = require("@utils/responseUtil");
const { getBabyInfo, babyPopulate } = require("@utils/babyUtil");
const { logActivity } = require("@utils/activityUtil");

const getFeedingTimetable = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 200,
        translationKey: "data_fetched_successfully",
        data: {
          hasBaby: false,
          recommendedToday: [],
        },
      });
    }

    const baby = await Baby.findById(user.activeBaby).populate(babyPopulate);

    if (!baby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    const { page, limit, skip } = parsePaginationParams(req);

    const today = new Date().toISOString().split("T")[0];

    const query = {
      baby: baby._id,
      user: req.user._id,
      date: today,
    };

    const [schedules, logs, totalRecords] = await Promise.all([
      FeedingSchedule.find(query).sort({ time: 1 }).skip(skip).limit(limit),

      FeedingLog.find(query),

      FeedingSchedule.countDocuments(query),
    ]);

    const completedIds = new Set(logs.map((log) => String(log.slotId)));

    const recommendedToday =
      schedules.map((slot) => ({
        _id: slot._id,
        type: slot.type,
        title: slot.title,
        description: slot.description,
        time: slot.time,
        completed: completedIds.has(String(slot._id)),
      })) || [];

    const nextMeal = recommendedToday.find((meal) => !meal.completed) || null;

    const recommendedTodayWithBadge = recommendedToday.map((meal) => ({
      ...meal,

      badge: meal.completed
        ? "completed"
        : nextMeal && String(meal.id) === String(nextMeal.id)
          ? "upnext"
          : null,
    }));

    const completionRate =
      recommendedToday.length === 0
        ? 0
        : Math.round(
            (recommendedToday.filter((meal) => meal.completed).length /
              recommendedToday.length) *
              100,
          );

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",

      data: {
        babyInfo: getBabyInfo(baby),

        completionRate,

        recommendedToday: recommendedTodayWithBadge,

        nextMeal,

        feedingNotes: [
          "Introduce one new food at a time to track allergies",

          "Use soft puree texture",

          "Observe reactions carefully",
        ],
      },
      meta: generateMeta(page, limit, totalRecords),
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};

const getTimetables = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("activeBaby");

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    const { page, limit, skip } = parsePaginationParams(req);

    const query = {
      baby: user.activeBaby,
      user: req.user._id,
    };

    const totalRecords = await FeedingSchedule.countDocuments(query);

    const timetables = await FeedingSchedule.find(query)
      .select("date")
      .sort({ date: -1 })
      .skip(skip)
      .limit(limit);

    const grouped = [
      ...new Map(
        timetables.map((item) => [
          item.date,
          {
            date: item.date,
          },
        ]),
      ).values(),
    ];

    const title = `Feeding Timetable for ${user.activeBaby.name}`;

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: grouped.map((x) => ({
        title: title,
        date: x.date,
        meta: generateMeta(page, limit, totalRecords),
      })),
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};

const getTimetableDetail = async (req, res) => {
  try {
    if (!validateParams(req, res, { queryParams: ["date"] })) return;
    const { date } = req.query;
    const user = await User.findById(req.user._id).populate("activeBaby");

    const baby = await Baby.findById(user.activeBaby).populate(babyPopulate);

    const schedules = await FeedingSchedule.find({
      baby: user.activeBaby,
      user: req.user._id,
      date,
    }).sort({ time: 1 });

    const logs = await FeedingLog.find({
      baby: user.activeBaby,
      user: req.user._id,
      date,
    });

    const completedIds = new Set(logs.map((log) => String(log.slotId)));

    const nextMeal =
      schedules.find((meal) => !completedIds.has(String(meal._id)))?._id ||
      null;

    const recommendedToday = schedules.map((slot) => ({
      _id: slot._id,
      type: slot.type,
      title: slot.title,
      description: slot.description,
      time: slot.time,
      completed: completedIds.has(String(slot._id)),
      badge: completedIds.has(String(slot._id))
        ? "Completed"
        : String(slot._id) === String(nextMeal)
          ? "upnext"
          : null,
    }));

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: {
        babyInfo: getBabyInfo(baby),
        recommendedToday,
      },
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};

const deleteTimetable = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    const { date } = req.query;

    const schedules = await FeedingSchedule.find({
      baby: user.activeBaby,
      user: req.user._id,
      date,
    });

    await FeedingSchedule.deleteMany({
      baby: user.activeBaby,
      user: req.user._id,
      date: req.query.date,
    });

    void logActivity({
      user: req.user._id,
      userType: req.user.role || "user",
      action: "delete",
      detail: `Deleted feeding timetable for ${date}`,
      module: "feeding_timetable",
      baby: user.activeBaby,
      targetId: user.activeBaby,
      metadata: {
        date,
        deletedSlots: schedules.length,
      },
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "timetable_deleted_successfully",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};

module.exports = {
  getFeedingTimetable,
  getTimetables,
  getTimetableDetail,
  deleteTimetable,
};
