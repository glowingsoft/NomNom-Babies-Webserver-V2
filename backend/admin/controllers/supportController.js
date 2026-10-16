const SupportRequest = require("../../models/SupportRequest");
const {
  sendResponse,
  validateParams,
  parsePaginationParams,
  generateMeta,
} = require("../../helperUtils/responseUtil");
const { logActivity } = require("@utils/activityUtil");

const getSupportRequests = async (req, res) => {
  try {
    const { page, limit, skip } = parsePaginationParams(req);

    const { keyword = "", status = "all" } = req.query;

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

    const counts = {
      pending: await SupportRequest.countDocuments({ status: "pending" }),
      responded: await SupportRequest.countDocuments({ status: "responded" }),
      resolved: await SupportRequest.countDocuments({ status: "resolved" }),
      closed: await SupportRequest.countDocuments({ status: "closed" }),
    };

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

module.exports = {
  getSupportRequests,
  updateSupportStatus,
  deleteSupportRequest,
};
