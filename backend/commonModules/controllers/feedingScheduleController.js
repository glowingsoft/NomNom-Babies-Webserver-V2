const FeedingSchedule = require("@models/FeedingSchedule");
const FeedingLog = require("@models/FeedingLog");
const {
  sendResponse,
  validateParams,
  parsePaginationParams,
  generateMeta,
} = require("@utils/responseUtil");
const Baby = require("@models/Baby");
const mongoose = require("mongoose");
const { User } = require("@models/UserModel");
const { logActivity } = require("@utils/activityUtil");

// Get feeding schedule for active baby on a given date
const getFeedingSchedule = async (req, res) => {
  try {
    if (!validateParams(req, res, { queryParams: ["date"] })) return;

    const { date } = req.query;
    const user = await User.findById(req.user._id);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    const { page, limit, skip } = parsePaginationParams(req);

    const totalRecords = await FeedingSchedule.countDocuments({
      baby: user.activeBaby,
      user: req.user._id,
      date,
    });

    const schedules = await FeedingSchedule.find({
      baby: user.activeBaby,
      user: req.user._id,
      date,
    })
      .sort({ time: 1 })
      .skip(skip)
      .limit(limit);

    if (!schedules.length) {
      return sendResponse({
        res,
        statusCode: 200,
        translationKey: "data_fetched_successfully",
        data: [],
        meta: generateMeta(page, limit, totalRecords),
      });
    }

    const logs = await FeedingLog.find({
      baby: user.activeBaby,
      user: req.user._id,
      date,
    });

    const completedIds = new Set(logs.map((log) => String(log.slotId)));

    const slots = schedules.map((item) => ({
      _id: item._id,
      type: item.type,
      title: item.title,
      description: item.description,
      time: item.time,
      isOptional: item.isOptional,
      completed: completedIds.has(String(item._id)),
    }));

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: slots,
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

const removeScheduleSlot = async (req, res) => {
  try {
    const { slotId } = req.params;
    const schedule = await FeedingSchedule.findOne({
      "weekSchedules.slots._id": slotId,
      user: req.user._id,
    });

    if (!schedule) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "feeding_schedule_not_found",
      });
    }

    await FeedingSchedule.updateOne(
      {
        user: req.user._id,
      },

      {
        $pull: {
          slots: {
            _id: slotId,
          },
        },
      },
    );

    await schedule.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "feeding_slot_deleted_success",
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

// Create feeding schedule for a baby
const createFeedingSchedule = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        rawData: ["type", "title", "time", "description"],
      })
    )
      return;

    const { type, title, time, description } = req.body;

    const user = await User.findById(req.user._id);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }
    const today = new Date().toISOString().split("T")[0];

    const schedule = await FeedingSchedule.create({
      baby: user.activeBaby,
      user: req.user._id,
      type,
      title,
      time,
      description,
      date: today,
    });

    void logActivity({
      user: req.user._id,
      userType: req.user.role || "user",
      action: "create",
      detail: `Created feeding schedule ${title}`,
      module: "feeding_schedule",
      baby: user.activeBaby,
      targetId: schedule._id,
      metadata: {
        type,
        title,
        time,
        date: today,
      },
    });

    const scheduleResponse = {
      _id: schedule._id,
      type: schedule.type,
      title: schedule.title,
      description: schedule.description,
      time: schedule.time,
      isOptional: schedule.isOptional,
      completed: false,
    };

    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "feeding_schedule_created_success",
      data: scheduleResponse,
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

// Update feeding schedule slots
const updateFeedingSchedule = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        pathParams: ["id"],
        objectIdFields: ["id"],
      })
    )
      return;

    const schedule = await FeedingSchedule.findOne({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!schedule) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "feeding_schedule_not_found",
      });
    }

    const { type, title, description, time, date, isOptional } = req.body;

    if (type !== undefined) schedule.type = type;
    if (title !== undefined) schedule.title = title;
    if (description !== undefined) schedule.description = description;
    if (time !== undefined) schedule.time = time;
    if (date !== undefined) schedule.date = date;
    if (isOptional !== undefined) schedule.isOptional = isOptional;

    await schedule.save();

    void logActivity({
      user: req.user._id,
      userType: req.user.role || "user",
      action: "update",
      detail: `Updated feeding schedule ${schedule.title}`,
      module: "feeding_schedule",
      baby: schedule.baby,
      targetId: schedule._id,
      metadata: {
        type: schedule.type,
        title: schedule.title,
        time: schedule.time,
        date: schedule.date,
      },
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "feeding_schedule_updated_success",
      data: {
        _id: schedule._id,
        baby: schedule.baby,
        user: schedule.user,
        date: schedule.date,
        type: schedule.type,
        title: schedule.title,
        description: schedule.description,
        time: schedule.time,
        isOptional: schedule.isOptional,
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

// Delete feeding schedule
const deleteFeedingSchedule = async (req, res) => {
  try {
    if (
      !validateParams(req, res, { pathParams: ["id"], objectIdFields: ["id"] })
    )
      return;

    const schedule = await FeedingSchedule.findOneAndDelete({
      _id: req.params.id,
      user: req.user._id,
    });

    if (!schedule) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "feeding_schedule_not_found",
      });
    }

    void logActivity({
      user: req.user._id,
      userType: req.user.role || "user",
      action: "delete",
      detail: `Deleted feeding schedule ${schedule.title}`,
      module: "feeding_schedule",
      baby: schedule.baby,
      targetId: schedule._id,
      metadata: {
        type: schedule.type,
        title: schedule.title,
        time: schedule.time,
        date: schedule.date,
      },
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "feeding_schedule_deleted_success",
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

const getUserFeedingSchedules = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        pathParams: ["userId"],
        objectIdFields: ["userId"],
      })
    )
      return;

    const { page, limit, skip } = parsePaginationParams(req);

    const query = {
      user: req.params.userId,
    };

    const totalRecords = await FeedingSchedule.countDocuments(query);

    const schedules = await FeedingSchedule.find(query)
      .populate("baby", "_id name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: schedules,
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

const getUserBabyFeedingSchedule = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        pathParams: ["userId", "babyId"],
        objectIdFields: ["userId", "babyId"],
      })
    )
      return;

    const { page, limit, skip } = parsePaginationParams(req);

    const query = {
      user: req.params.userId,
      baby: req.params.babyId,
    };

    const totalRecords = await FeedingSchedule.countDocuments(query);

    const schedule = await FeedingSchedule.find(query)
      .populate("baby", "_id name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    if (!schedule) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "feeding_schedule_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: schedule,
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

// Mark / unmark a slot as completed for a given date
const toggleSlotCompletion = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        pathParams: ["slotId"],
        objectIdFields: ["slotId"],
      })
    )
      return;

    const { slotId } = req.params;

    const user = await User.findById(req.user._id);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    const slot = await FeedingSchedule.findOne({
      _id: slotId,
      baby: user.activeBaby,
      user: req.user._id,
    });

    if (!slot) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "feeding_slot_not_found",
      });
    }

    const existing = await FeedingLog.findOne({
      baby: user.activeBaby,

      user: req.user._id,

      slotId,

      date: slot.date,
    });

    if (existing) {
      await existing.deleteOne();

      void logActivity({
        user: req.user._id,
        userType: req.user.role || "user",
        action: "uncomplete",
        detail: `Unmarked feeding slot ${slot.title}`,
        module: "feeding_schedule",
        baby: user.activeBaby,
        targetId: slot._id,
        metadata: {
          date: slot.date,
          time: slot.time,
        },
      });

      return sendResponse({
        res,

        statusCode: 200,

        translationKey: "feeding_slot_unmarked",

        data: {
          slotId,

          completed: false,
        },
      });
    }

    await FeedingLog.create({
      baby: user.activeBaby,

      user: req.user._id,

      slotId,

      date: slot.date,

      completed: true,
    });

    void logActivity({
      user: req.user._id,
      userType: req.user.role || "user",
      action: "complete",
      detail: `Completed feeding slot ${slot.title}`,
      module: "feeding_schedule",
      baby: user.activeBaby,
      targetId: slot._id,
      metadata: {
        date: slot.date,
        time: slot.time,
      },
    });

    return sendResponse({
      res,

      statusCode: 200,

      translationKey: "feeding_slot_completed",

      data: {
        slotId,

        completed: true,
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

const startFeedingPlan = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user?.activeBaby) {
      return sendResponse({
        res,

        statusCode: 404,

        translationKey: "baby_not_found",
      });
    }

    const baby = await Baby.findById(user.activeBaby);

    baby.feedingPlanStarted = true;

    baby.feedingPlanStartedAt = new Date();

    await baby.save();

    void logActivity({
      user: req.user._id,
      userType: req.user.role || "user",
      action: "start",
      detail: "Started feeding plan",
      module: "feeding_plan",
      baby: baby._id,
      targetId: baby._id,
      metadata: {
        startedAt: baby.feedingPlanStartedAt,
      },
    });

    return sendResponse({
      res,

      statusCode: 200,

      translationKey: "feeding_plan_started",
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
  getFeedingSchedule,
  getUserFeedingSchedules,
  getUserBabyFeedingSchedule,
  removeScheduleSlot,
  createFeedingSchedule,
  updateFeedingSchedule,
  deleteFeedingSchedule,
  toggleSlotCompletion,
  startFeedingPlan,
};
