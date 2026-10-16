const Subscription = require("@models/Subscription");
const {
  sendResponse,
  parsePaginationParams,
  generateMeta,
  validateParams,
} = require("@utils/responseUtil");

const getSubscriptions = async (req, res) => {
  try {
    const { page, limit, skip } = parsePaginationParams(req);

    const query = {
      isActive: true,
    };

    const [subscriptions, totalRecords] = await Promise.all([
      Subscription.find(query).sort({ sortOrder: 1 }).skip(skip).limit(limit),

      Subscription.countDocuments(query),
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: subscriptions,
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

const getSubscriptionDetail = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        pathParams: ["subscriptionId"],
        objectIdFields: ["subscriptionId"],
      })
    )
      return;

    const subscriptions = await Subscription.findById(
      req.params.subscriptionId,
    );
    if (!subscriptions) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "subscription_not_found",
      });
    }
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: subscriptions,
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

const createSubscription = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        rawData: [
          "title",
          "price",
          "currency",
          "billingCycle",
          "features",
          "sortOrder",
        ],
      })
    )
      return;

    const subscriptions = await Subscription.create({
      title: req.body.title,
      price: req.body.price,
      currency: req.body.currency,
      billingCycle: req.body.billingCycle,
      badge: req.body.badge || "",
      features: req.body.features|| [],
      sortOrder: req.body.sortOrder,
      isActive: req.body.isActive ?? true,
    });
    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "subscription_created_successfully",
      data: subscriptions,
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

const updateSubscription = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        pathParams: ["subscriptionId"],
        objectIdFields: ["subscriptionId"],
      })
    )
      return;

    const subscriptions = await Subscription.findByIdAndUpdate(
      req.params.subscriptionId,
      {
        title: req.body.title,
        price: req.body.price,
        currency: req.body.currency,
        billingCycle: req.body.billingCycle,
        badge: req.body.badge,
        features: req.body.features,
        sortOrder: req.body.sortOrder,
        isActive: req.body.isActive,
      },
      { new: true },
    );
    if (!subscriptions) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "subscription_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "subscription_updated_success",
      data: subscriptions,
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

const deleteSubscription = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        pathParams: ["subscriptionId"],
        objectIdFields: ["subscriptionId"],
      })
    )
      return;

    const subscriptions = await Subscription.findByIdAndDelete(
      req.params.subscriptionId,
    );
    if (!subscriptions) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "subscription_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "subscription_deleted_success",
      data: subscriptions,
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
  getSubscriptions,
  getSubscriptionDetail,
  createSubscription,
  updateSubscription,
  deleteSubscription,
};
