const SupportRequest = require("../../models/SupportRequest");
const {
  sendResponse,
  validateParams,
  parsePaginationParams,
  generateMeta,
} = require("../../helperUtils/responseUtil");
const { logActivity } = require("@utils/activityUtil");
const { statusCounts } = require("@utils/statusCounts");
const { closeStalePendingRequests } = require("@utils/supportAutoClose");
const { sendEmailViaSgrid } = require("@utils/emailUtil");
const { supportReplyEmailTemplate } = require("@utils/emailTemplates");

const ADMIN_SETTABLE_STATUSES = ["open", "resolved"];

const getSupportRequests = async (req, res) => {
  try {
    const { page, limit, skip } = parsePaginationParams(req);

    const { keyword = "", status = "all" } = req.query;

    await closeStalePendingRequests().catch(() => {});

    const query = {};

    if (status !== "all") {
      query.status = status;
    }

    if (keyword) {
      query.$or = [
        { name: { $regex: keyword, $options: "i" } },
        { email: { $regex: keyword, $options: "i" } },
        { subject: { $regex: keyword, $options: "i" } },
        { message: { $regex: keyword, $options: "i" } },
      ];
    }

    const totalRecords = await SupportRequest.countDocuments(query);

    const data = await SupportRequest.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const counts = await statusCounts(SupportRequest, {
      statuses: ["pending", "open", "responded", "resolved", "closed"],
      defaultStatus: "pending",
    });

    return sendResponse({
      res,
      translationKey: "success",
      data,
      meta: {
        ...generateMeta(page, limit, totalRecords),
        counts,
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

const updateSupportStatus = async (req, res) => {
  if (
    !validateParams(req, res, {
      pathParams: ["id"],
      rawData: ["status"],
      objectIdFields: ["id"],
    })
  )
    return;

  if (!ADMIN_SETTABLE_STATUSES.includes(req.body.status)) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: "invalid_status",
      values: { allowed: ADMIN_SETTABLE_STATUSES.join(", ") },
    });
  }

  const support = await SupportRequest.findByIdAndUpdate(
    req.params.id,
    {
      status: req.body.status,
    },
    {
      new: true,
      runValidators: true,
    },
  );

  if (!support) {
    return sendResponse({
      res,
      statusCode: 404,
      translationKey: "not_found",
    });
  }
  void logActivity({
    user: req.user._id,
    userType: req.user.userType,
    action: "update",
    detail: `Updated support request status to ${support.status}`,
    module: "support",
    targetId: support._id,
    metadata: {
      subject: support.subject,
      email: support.email,
      status: support.status,
    },
  });

  return sendResponse({
    res,
    translationKey: "updated_successfully",
    data: support,
  });
};

const deleteSupportRequest = async (req, res) => {
  if (
    !validateParams(req, res, {
      pathParams: ["id"],
      objectIdFields: ["id"],
    })
  )
    return;

  const support = await SupportRequest.findByIdAndDelete(req.params.id);

  if (!support) {
    return sendResponse({
      res,
      statusCode: 404,
      translationKey: "not_found",
    });
  }

  void logActivity({
    user: req.user._id,
    userType: req.user.userType,
    action: "delete",
    detail: `Deleted support request: ${support.subject}`,
    module: "support",
    targetId: support._id,
    metadata: {
      name: support.name,
      email: support.email,
      subject: support.subject,
      status: support.status,
    },
  });

  return sendResponse({
    res,
    translationKey: "deleted_successfully",
  });
};

const replyToSupportRequest = async (req, res) => {
  if (
    !validateParams(req, res, {
      pathParams: ["id"],
      objectIdFields: ["id"],
    })
  )
    return;

  const message =
    typeof req.body?.message === "string" ? req.body.message.trim() : "";

  if (!message) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: "reply_message_required",
    });
  }

  const support = await SupportRequest.findById(req.params.id);

  if (!support) {
    return sendResponse({
      res,
      statusCode: 404,
      translationKey: "not_found",
    });
  }

  try {
    await sendEmailViaSgrid(
      "NomNom Babies Support",
      [support.email],
      `Re: ${support.subject}`,
      supportReplyEmailTemplate({
        name: support.name,
        subject: support.subject,
        reply: message,
        originalMessage: support.message,
        reference: `#${String(support._id).slice(-6).toUpperCase()}`,
        submittedAt: new Date(support.createdAt).toLocaleDateString("en-GB", {
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
      }),
    );
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "email_send_failed",
      error: error.message,
    });
  }

  support.status = "responded";
  await support.save();

  void logActivity({
    user: req.user._id,
    userType: req.user.userType,
    action: "reply",
    detail: `Replied to support request: ${support.subject}`,
    module: "support",
    targetId: support._id,
    metadata: {
      subject: support.subject,
      email: support.email,
      status: support.status,
    },
  });

  return sendResponse({
    res,
    translationKey: "reply_sent_successfully",
    data: support,
  });
};

module.exports = {
  getSupportRequests,
  updateSupportStatus,
  replyToSupportRequest,
  deleteSupportRequest,
};
