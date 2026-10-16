const Reminder = require("@models/Reminder");
const {
  sendResponse,
  parsePaginationParams,
  generateMeta,
  validateParams,
} = require("@utils/responseUtil");

const getRecentReminders = async (req, res) => {
  try {
    const { page, limit, skip } = parsePaginationParams(req);

    const query = {
      isActive: true,
    };

    const [records, totalRecords] = await Promise.all([
      Reminder.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),

      Reminder.countDocuments(query),
    ]);
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: records,
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

const getReminderDetail = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        pathParams: ["reminderId"],
        objectIdFields: ["reminderId"],
      })
    )
      return;
    const reminder = await Reminder.findById(req.params.reminderId);
    if (!reminder) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "reminder_not_found",
      });
    }
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: reminder,
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

// ADMIN CRUD

const createReminder = async (req, res) => {
  try {
    if (
      !validateParams(req, res, { rawData: ["title", "description", "tags"] })
    )
      return;

    const reminder = await Reminder.create({
      title: req.body.title,
      description: req.body.description,
      tags: req.body.tags || [],
    });

    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "reminder_created_success",
      data: reminder,
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

const getAllReminders = async (req, res) => {
  try {
    const { page, limit, skip } = parsePaginationParams(req);

    const query = {};

    const [records, totalRecords] = await Promise.all([
      Reminder.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),

      Reminder.countDocuments(query),
    ]);
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: records,
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

const getReminderbyId = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        pathParams: ["reminderId"],
        objectIdFields: ["reminderId"],
      })
    )
      return;

    const reminder = await Reminder.findById(req.params.reminderId);
    if (!reminder) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "reminder_not_found",
      });
    }
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: reminder,
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

const updateReminder = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        pathParams: ["reminderId"],
        objectIdFields: ["reminderId"],
      })
    )
      return;

    const reminder = await Reminder.findByIdAndUpdate(
      req.params.reminderId,
      {
        title: req.body.title,
        description: req.body.description,
        tags: req.body.tags || [],
        isActive: req.body.isActive,
      },
      { new: true },
    );
    if (!reminder) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "reminder_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "reminder_updated_success",
      data: reminder,
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

const deleteReminder = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        pathParams: ["reminderId"],
        objectIdFields: ["reminderId"],
      })
    )
      return;

    const reminder = await Reminder.findByIdAndDelete(req.params.reminderId);
    if (!reminder) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "reminder_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "reminder_deleted_success",
      data: reminder,
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
  getRecentReminders,
  getReminderDetail,
  createReminder,
  getAllReminders,
  getReminderbyId,
  updateReminder,
  deleteReminder,
};
