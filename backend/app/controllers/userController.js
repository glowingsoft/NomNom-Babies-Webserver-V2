const { User, SubscriptionType } = require("@models/UserModel");
const moment = require("moment");
const {
  sendResponse,
  validateParams,
  parsePaginationParams,
  generateMeta,
} = require("@utils/responseUtil");
const { formatUserResponse } = require("@utils/userResponseUtil");
const { NotificationTypes } = require("@models/Notifications");
const validator = require("validator");
const { userCache } = require("@config/nodeCache");
const Baby = require("@models/Baby");
const { babyPopulate, getBabyInfo } = require("@utils/babyUtil");

const blockUser = async (req, res) => {
  const { _id } = req.user;
  const { userIdToBlock } = req.params;

  const validationOptions = {
    pathParams: ["userIdToBlock"],
    objectIdFields: ["userIdToBlock"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return;
  }
  if (_id.equals(userIdToBlock)) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: "you_cannot",
    });
  }
  try {
    const [currentUser, userToBlock] = await Promise.all([
      User.findById(_id).select("blockedUsers"),
      User.findById(userIdToBlock),
    ]);

    if (!userToBlock) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "user_to_1",
      });
    }

    if (currentUser.blockedUsers.includes(userIdToBlock)) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "user_is",
      });
    }

    currentUser.blockedUsers.push(userIdToBlock);

    await currentUser.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "user_blocked",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "an_error_9",
      error,
    });
  }
};

const reportUser = async (req, res) => {
  const currentUser = req.user;
  const { userIdToReport } = req.params;

  const validationOptions = {
    pathParams: ["userIdToReport"],
    objectIdFields: ["userIdToReport"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return;
  }
  if (currentUser._id.equals(userIdToReport)) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: "you_cannot_1",
    });
  }
  try {
    const userToReport = await User.findById(userIdToReport);

    if (!userToReport) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "user_to_2",
      });
    }

    if (userToReport.reportedBy.includes(currentUser._id)) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "you_have",
      });
    }

    userToReport.reportedBy.push(currentUser._id);

    userToReport.reportCount += 1;

    if (userToReport.reportCount >= 10) {
      userToReport.accountState.status = "suspended";
      userToReport.accountState.reason =
        "User suspended due to multiple reports.";
      userToReport.accountState.suspensionDate = new Date();
    }

    await userToReport.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "user_reported",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "an_error_10",
      error,
    });
  }
};

const addOrUpdateSubscription = async (req, res) => {
  const { type } = req.body;
  const { _id } = req.user;

  if (!Object.values(SubscriptionType).includes(type)) {
    const validSubscriptionTypes = Object.values(SubscriptionType);
    const errorMessage =
      "Invalid subscription type. Valid types are: " +
      validSubscriptionTypes.join(", ");
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: errorMessage,
    });
  }

  try {
    const user = await User.findById(_id).select("subscriptions");
    const existingSubscription = user.subscriptions.find(
      (sub) => sub.type === type,
    );

    if (existingSubscription) {
      if (type === SubscriptionType.BLOOM_AGAIN_ESSENTIALS) {
        existingSubscription.endDate = moment(existingSubscription.endDate)
          .add(1, "month")
          .toDate();
      } else if (type === SubscriptionType.HEALING_HEARTS) {
        existingSubscription.endDate = moment(existingSubscription.endDate)
          .add(1, "year")
          .toDate();
      }
    } else {
      let endDate = null;
      if (type === SubscriptionType.BLOOM_AGAIN_ESSENTIALS) {
        endDate = moment().add(1, "month").toDate();
      } else if (type === SubscriptionType.HEALING_HEARTS) {
        endDate = moment().add(1, "year").toDate();
      }

      user.subscriptions.push({
        type,
        startDate: new Date(),
        endDate,
      });
    }

    await user.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "subscription_added",
      data: user.subscriptions,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey:
        "An error occurred while adding or updating the subscription",
      error,
    });
  }
};

const removeSubscription = async (req, res) => {
  const { _id: userId } = req.user;
  const { subscriptionId } = req.params;

  try {
    const user = await User.findById(userId).select("subscriptions");
    const subscriptionIndex = user.subscriptions.findIndex(
      (sub) => sub._id.toString() === subscriptionId,
    );
    if (subscriptionIndex === -1) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "subscription_not",
      });
    }

    user.subscriptions.splice(subscriptionIndex, 1);

    await user.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "subscription_removed",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "an_error_12",
      error,
    });
  }
};

const getSubscriptions = async (req, res) => {
  const { _id } = req.user;

  try {
    const user = await User.findById(_id).select("subscriptions");
    const subscriptions = user.subscriptions;

    if (
      subscriptions.length === 1 &&
      subscriptions[0].type === SubscriptionType.SPARK_CONNECTION
    ) {
      subscriptions[0].isActive = true;
    } else {
      const activeSubscriptions = subscriptions.filter((sub) => {
        return (
          sub.endDate &&
          moment(sub.endDate).isAfter(moment()) &&
          sub.type !== SubscriptionType.SPARK_CONNECTION
        );
      });

      if (activeSubscriptions.length > 0) {
        const maxExpirySubscription = activeSubscriptions.reduce(
          (maxSub, currentSub) => {
            return moment(currentSub.endDate).isAfter(moment(maxSub.endDate))
              ? currentSub
              : maxSub;
          },
        );

        subscriptions.forEach((sub) => {
          sub.isActive = sub._id.equals(maxExpirySubscription._id);
        });
      }
    }

    const formattedSubscriptions = subscriptions.map((sub) => {
      return {
        ...sub.toObject(),
        isActive: sub.isActive,
      };
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "user_subscriptions",
      data: formattedSubscriptions,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "an_error_13",
      error,
    });
  }
};

const populationFields = {};

/**
 * Dynamic population function to fetch user with populated fields.
 * @param {String} userId - The ID of the user to fetch.
 * @param {Array} fieldsToPopulate - An array of fields that need to be populated.
 * @returns {Promise<Object>} - The populated user object.
 */
const getUserWithPopulatedFields = async (userId, fieldsToPopulate = []) => {
  try {
    let query = User.findById(userId);

    fieldsToPopulate.forEach((field) => {
      const populationConfig = populationFields[field];
      if (populationConfig) {
        query = query.populate(populationConfig.path, populationConfig.select);
      }
    });

    const user = await query.exec();
    return user;
  } catch (error) {
    console.error("Error fetching user:", error);
    throw new Error("User fetch error");
  }
};

/**
 * Dynamic population function to fetch user with populated fields.
 * @param {String} userId - The ID of the user to fetch.
 * @param {Array} fieldsToPopulate - An array of fields that need to be populated.
 * @returns {Promise<Object>} - The populated user object.
 */
const getUserProfile = async (req, res, next, fieldsToPopulate = []) => {
  try {
    const currentUser = req.user;

    let query = User.findById(currentUser._id).populate(
      "onboarding.selectedCountries",
      "_id name signatureFoods",
    );

    if (fieldsToPopulate.length > 0) {
      fieldsToPopulate.forEach((field) => {
        const populationConfig = populationFields[field];
        if (populationConfig) {
          query = query.populate(
            populationConfig.path,
            populationConfig.select,
          );
        }
      });
    }

    const user = await query.exec();

    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "user_not",
      });
    }

    let activeBaby = null;

    if (user.activeBaby) {
      activeBaby = await Baby.findById(user.activeBaby).populate(babyPopulate);
    }

    const response = formatUserResponse(user, null, [], ["resetToken"]);
    response.babyInfo = activeBaby ? getBabyInfo(activeBaby) : null;

    response.hasBaby = !!activeBaby;
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "user_fetched",
      data: response,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: `An error occurred while fetching the user: ${error.message}`,
      error,
    });
  }
};

const getOtherUserProfile = async (req, res, next) => {
  try {
    const userId = req.params.userId;

    const [user, recentReviews] = await Promise.all([
      User.findById(userId).select(
        "profileIcon name phoneNumber verificationStatus.phoneNumber",
      ),
      Review.find({ object: userId, reviewType: "user" })
        .sort({ createdAt: -1 })
        .limit(5)
        .populate("subject", "_id name profileIcon"),
    ]);

    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "user_not",
      });
    }

    const response = formatUserResponse(
      user,
      null,
      [],
      ["resetToken", "accountState", "metadata"],
    );

    response.contactInfo = {
      phoneNumber: user.phoneNumber,
      verificationStatus: user.verificationStatus.phoneNumber,
    };

    response.recentReviews = recentReviews;

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "user_fetched",
      data: response,
    });
  } catch (error) {
    console.error("Error fetching user:", error);
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: error.message,
      error,
    });
  }
};

/**
 * Update user profile function.
 * @param {Object} req - The request object containing user data.
 * @param {Object} res - The response object.
 * @param {Function} next - The next middleware function.
 * @returns {Promise<void>}
 */
const updateUserProfile = async (req, res, next) => {
  const {
    name,
    profileIcon,
    phoneNumber,
    parentCaregiverName,
    babyName,
    location,
    distanceUnit,
  } = req.body;
  const currentUser = req.user;

  try {
    const user = await User.findById(currentUser._id);

    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "user_not",
      });
    }

    if (babyName) {
      if (!user.activeBaby) {
        return sendResponse({
          res,
          statusCode: 404,
          translationKey: "baby_not_found",
        });
      }

      const baby = await Baby.findById(user.activeBaby);

      if (!baby) {
        return sendResponse({
          res,
          statusCode: 404,
          translationKey: "baby_not_found",
        });
      }

      baby.name = babyName.trim();

      await baby.save();
    }

    if (profileIcon) {
      user.profileIcon = profileIcon;
    }

    if (distanceUnit) {
      user.distanceUnit = distanceUnit;
    }

    if (name && name.trim() !== "") user.name = name;
    if (parentCaregiverName && parentCaregiverName.trim() !== "")
      user.parentCaregiverName = parentCaregiverName;
    if (phoneNumber) {
      if (!validator.isMobilePhone(phoneNumber)) {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey: "invalid_phone_1",
        });
      }
      user.phoneNumber = phoneNumber;
    }

    if (location) {
      const { coordinates, fullAddress } = location;
      if (!coordinates || coordinates.length !== 2 || !fullAddress) {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey: "invalid_location_1",
        });
      }
      const [longitude, latitude] = coordinates;
      if (typeof longitude !== "number" || typeof latitude !== "number") {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey: "invalid_coordinates",
        });
      }
      user.location = {
        type: "Point",
        coordinates: [longitude, latitude],
        fullAddress,
      };
    }
    await user.save();

    userCache.del(currentUser._id.toString());

    let query = User.findById(currentUser._id).populate(
      "onboarding.selectedCountries",
      "_id name signatureFoods",
    );

    Object.keys(populationFields).forEach((field) => {
      const populationConfig = populationFields[field];
      if (populationConfig) {
        query = query.populate(populationConfig.path, populationConfig.select);
      }
    });

    const updatedUser = await query.exec();

    let activeBaby = null;

    if (updatedUser.activeBaby) {
      activeBaby = await Baby.findById(updatedUser.activeBaby).populate(
        babyPopulate,
      );
    }

    const response = formatUserResponse(updatedUser, null, [], ["resetToken"]);

    response.babyInfo = activeBaby ? getBabyInfo(activeBaby) : null;
    response.hasBaby = !!activeBaby;

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "user_profile",
      data: response,
    });
  } catch (error) {
    console.error("Error updating user profile:", error);
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "user_profile_update_error",
      values: { errorMessage: error.message },
      error,
    });
  }
};

module.exports = {
  blockUser,
  reportUser,
  addOrUpdateSubscription,
  removeSubscription,
  getSubscriptions,
  getUserWithPopulatedFields,
  getUserProfile,
  updateUserProfile,
  getOtherUserProfile,
};
