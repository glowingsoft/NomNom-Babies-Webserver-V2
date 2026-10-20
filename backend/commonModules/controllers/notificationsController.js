const {
  sendResponse,
  generateMeta,
  parsePaginationParams,
} = require("@utils/responseUtil");
const moment = require("moment-timezone");
const { NotificationExp } = require("@models/Notifications");
const { User } = require("@models/UserModel");
const { lookupOne } = require("@utils/aggregationUtil");

const getNotifications = async (req, res) => {
  const { page, limit } = parsePaginationParams(req);

  try {
    const castedQuery = NotificationExp.find({
      receiverId: req.user._id,
    }).cast(NotificationExp);

    const [notifications, totalNotifications] = await Promise.all([
      NotificationExp.aggregate([
        { $match: castedQuery },
        { $sort: { createdAt: -1 } },
        { $skip: (page - 1) * limit },
        { $limit: limit },
        ...lookupOne({
          from: User.collection.name,
          field: "subjectId",
          fields: [
            "_id",
            { name: "name", default: "" },
            { name: "profileIcon", default: "" },
          ],
        }),
        { $addFields: { isRead: { $ifNull: ["$isRead", false] } } },
        { $unset: "data" },
      ]),
      NotificationExp.countDocuments({ receiverId: req.user._id }),
    ]);

    const meta = generateMeta(page, limit, totalNotifications);

    const formattedNotifications = notifications.map((notification) => {
      const {
        _id,
        type,
        objectId,
        title,
        body,
        data,
        url,
        isRead,
        createdAt,
        objectType,
        subjectId,
        receiverId,
      } = notification;
      const userTimezone = req.user.timezone || "UTC";
      const timeSince = moment(createdAt).tz(userTimezone).fromNow();

      return {
        _id,
        type,
        objectId,
        objectType,
        subject: subjectId,
        title,
        body,
        data,
        isRead,
        timeSince,
      };
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "notifications_fetched_success",
      data: formattedNotifications,
      meta: meta,
    });
  } catch (error) {
    console.error(error);
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "notifications_fetch_error",
      error,
    });
  }
};

const readNotification = async (req, res) => {
  try {
    const notification = await NotificationExp.findByIdAndUpdate(
      req.params.id,
      { isRead: true },
      { new: true },
    );
    if (!notification) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "notification_not_found",
      });
    }
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "notification_marked_read_success",
      data: notification,
    });
  } catch (error) {
    console.error(error);
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "notification_mark_read_error",
      error,
    });
  }
};

module.exports = {
  getNotifications,
  readNotification,
};
