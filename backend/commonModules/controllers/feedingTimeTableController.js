const Baby = require("@models/Baby");
const FeedingSchedule = require("@models/FeedingSchedule");
const FeedingLog = require("@models/FeedingLog");
const { User } = require("@models/UserModel");
const {
  sendResponse,
  parsePaginationParams,
  generateMeta,
  validateParams,
  getUserToday,
} = require("@utils/responseUtil");
const { getBabyInfo } = require("@utils/babyUtil");
const { logActivity } = require("@utils/activityUtil");
const { babyPopulateStages, lookupOne } = require("@utils/aggregationUtil");

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

    const [baby] = await Baby.aggregate([
      { $match: { _id: user.activeBaby } },
      ...babyPopulateStages(),
    ]);

    if (!baby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    const { page, limit, skip } = parsePaginationParams(req);

    const today = getUserToday(req.user);

    const query = {
      baby: baby._id,
      user: req.user._id,
      date: today,
    };

    const [schedules, logs, totalRecords] = await Promise.all([
      FeedingSchedule.find(query).sort({ timeMinutes: 1, time: 1 }).skip(skip).limit(limit),

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
        : nextMeal && String(meal._id) === String(nextMeal._id)
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
    const castedUser = User.find({ _id: req.user._id }).cast(User);

    const [user] = await User.aggregate([
      { $match: castedUser },
      ...lookupOne({
        from: Baby.collection.name,
        field: "activeBaby",
        fields: ["_id", "name"],
      }),
    ]);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    const { page, limit, skip } = parsePaginationParams(req);

    // One timetable per day: group the slots by date, newest first, and paginate over days.
    const [result] = await FeedingSchedule.aggregate([
      { $match: { baby: user.activeBaby._id, user: user._id } },
      { $group: { _id: "$date", slots: { $sum: 1 } } },
      { $sort: { _id: -1 } },
      {
        $facet: {
          data: [{ $skip: skip }, { $limit: limit }],
          total: [{ $count: "count" }],
        },
      },
    ]);

    const totalRecords = result?.total?.[0]?.count || 0;
    const title = `Feeding Timetable for ${user.activeBaby.name}`;

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: (result?.data || []).map((day) => ({
        title,
        date: day._id,
        totalSlots: day.slots,
      })),
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

const getTimetableDetail = async (req, res) => {
  try {
    if (!validateParams(req, res, { queryParams: ["date"] })) return;
    const { date } = req.query;
    const castedUser = User.find({ _id: req.user._id }).cast(User);

    const user =
      (
        await User.aggregate([
          { $match: castedUser },
          ...lookupOne({
            from: Baby.collection.name,
            field: "activeBaby",
            fields: ["_id"],
          }),
        ])
      )[0] ?? null;

    const activeBabyId = user.activeBaby ? user.activeBaby._id : null;

    const [baby] = await Baby.aggregate([
      { $match: { _id: activeBabyId } },
      ...babyPopulateStages(),
    ]);

    const schedules = await FeedingSchedule.find({
      baby: activeBabyId,
      user: req.user._id,
      date,
    }).sort({ timeMinutes: 1, time: 1 });

    const logs = await FeedingLog.find({
      baby: activeBabyId,
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
