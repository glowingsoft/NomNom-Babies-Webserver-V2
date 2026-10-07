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

// Block User Function
const blockUser = async (req, res) => {
  const { _id } = req.user;
  const { userIdToBlock } = req.params; // ID of the user to block

  const validationOptions = {
    pathParams: ["userIdToBlock"],
    objectIdFields: ["userIdToBlock"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return; // Validation failed, response already sent
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

    // Check if already blocked
    if (currentUser.blockedUsers.includes(userIdToBlock)) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "user_is",
      });
    }

    // Add the user to the blocked list of the current user
    currentUser.blockedUsers.push(userIdToBlock);

    // Save the current user
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

// Report User Function
const reportUser = async (req, res) => {
  const currentUser = req.user;
  const { userIdToReport } = req.params; // ID of the user to report

  const validationOptions = {
    pathParams: ["userIdToReport"],
    objectIdFields: ["userIdToReport"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return; // Validation failed, response already sent
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

    // Check if current user has already reported this user
    if (userToReport.reportedBy.includes(currentUser._id)) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "you_have",
      });
    }

    // Add current user's ID to the reportedBy list
    userToReport.reportedBy.push(currentUser._id);

    // Increment the report count
    userToReport.reportCount += 1;

    // Check if user should be suspended
    if (userToReport.reportCount >= 10) {
      userToReport.accountState.status = "suspended";
      userToReport.accountState.reason =
        "User suspended due to multiple reports.";
      userToReport.accountState.suspensionDate = new Date();
    }

    // Save the reported user
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

// Add or update a subscription for a user
const addOrUpdateSubscription = async (req, res) => {
  const { type } = req.body;
  const { _id } = req.user;

  // Validate subscription type
  if (!Object.values(SubscriptionType).includes(type)) {
    // Convert SubscriptionType values to an array
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
    // Check if the subscription already exists
    const existingSubscription = user.subscriptions.find(
      (sub) => sub.type === type, // Use 'type' instead of 'status'
    );

    if (existingSubscription) {
      // Update the expiry date based on subscription type
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
      // Add new subscription
      let endDate = null;
      if (type === SubscriptionType.BLOOM_AGAIN_ESSENTIALS) {
        endDate = moment().add(1, "month").toDate();
      } else if (type === SubscriptionType.HEALING_HEARTS) {
        endDate = moment().add(1, "year").toDate();
      }

      user.subscriptions.push({
        type, // Correct 'type' field
        startDate: new Date(),
        endDate,
      });
    }

    // Save the user with the updated subscription
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

// Remove a subscription
const removeSubscription = async (req, res) => {
  const { _id: userId } = req.user;
  const { subscriptionId } = req.params;

  try {
    // Find and remove the subscription
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

    // Save the user after removing the subscription
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

// Get all subscriptions for a user
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

// Create a mapping for all possible fields and their respective collections
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

    // Build the dynamic population based on the fields requested
    fieldsToPopulate.forEach((field) => {
      const populationConfig = populationFields[field];
      if (populationConfig) {
        query = query.populate(populationConfig.path, populationConfig.select);
      }
    });

    // Execute the query and return the populated user
    const user = await query.exec();
    return user; // Return the user object
  } catch (error) {
    console.error("Error fetching user:", error);
    throw new Error("User fetch error"); // Let the middleware handle the error response
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

    // Build the dynamic population based on the fields requested
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

    // Execute the query and return the populated user
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

    // Include phone number if there are bookings with status "booked" or "picked"
    // if (bookings.length > 0) {
    response.contactInfo = {
      phoneNumber: user.phoneNumber,
      verificationStatus: user.verificationStatus.phoneNumber,
    };
    // }

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

    // Update fields if provided
    if (name && name.trim() !== "") user.name = name;
    if (parentCaregiverName && parentCaregiverName.trim() !== "")
      user.parentCaregiverName = parentCaregiverName;
    if (phoneNumber) {
      //validate phone using validator
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
      // Validate location
      const { coordinates, fullAddress } = location;
      if (!coordinates || coordinates.length !== 2 || !fullAddress) {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey: "invalid_location_1",
        });
      }
      // Ensure coordinates are numbers
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

    // Agar update API mein bhi ye populate chahiye
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
      translationKey: "user_profile_update_error", // Use a translation key
      values: { errorMessage: error.message }, // Pass the error message as a dynamic value
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
