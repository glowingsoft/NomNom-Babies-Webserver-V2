const { convertUtcToTimezone } = require("./responseUtil");
const { getFullImageUrl } = require("@utils/imageHelper");

const formatUserResponse = (
  userObject,
  token = null,
  includeFields = [],
  excludeFields = [],
) => {
  var pIcon = null;
  if (userObject.profileIcon) {
    pIcon = userObject.profileIcon;
  }

  if (pIcon) {
    pIcon = getFullImageUrl(pIcon);
  }

  const response = {
    basicInfo: {
      _id: userObject._id,
      profileIcon: pIcon,
      name: userObject.name,
      parentName: userObject.parentCaregiverName,
      email: userObject.email,
      phoneNumber: userObject.phoneNumber,
      language: userObject.language,
    },
    accountState: {
      userType:
        userObject.accountState?.userType ||
        userObject.role ||
        userObject.userType ||
        "parent",
      role:
        userObject.accountState?.userType ||
        userObject.role ||
        userObject.userType ||
        "parent",
      status: userObject.accountState?.status || "active",
      verificationStatus: userObject.verificationStatus || {
        email: "pending",
        phoneNumber: "pending",
      },
      ...(userObject.accountState?.reason
        ? { reason: userObject.accountState.reason }
        : {}),
    },
  };

  response.metadata = {
    timezone: userObject.timezone,
    createdAt: userObject.createdAt,
    updatedAt: userObject.updatedAt,
    __v: userObject.__v,
  };

  let otpExpLocalTz;
  if (userObject.otpInfo && userObject.otpInfo.otpExpires) {
    otpExpLocalTz = convertUtcToTimezone(
      userObject.otpInfo.otpExpires,
      userObject.timezone,
    );
  }

  if (process.env.NODE_ENV === "dev" && userObject.otpInfo) {
    response.otpInfo = userObject.otpInfo;
  }
  if (userObject.resetToken) {
    response.resetToken = userObject.resetToken;
  }
  if (token) {
    response.token = token;
  }

  let finalResponse = response;

  if (includeFields.length > 0) {
    finalResponse = {};
    includeFields.forEach((field) => {
      if (response[field]) {
        finalResponse[field] = response[field];
      }
    });
  }

  if (excludeFields.length > 0) {
    excludeFields.forEach((fieldPath) => {
      const [mainField, subField] = fieldPath.split(".");
      if (subField) {
        if (finalResponse[mainField]) {
          delete finalResponse[mainField][subField];
        }
      } else {
        delete finalResponse[fieldPath];
      }
    });

    return finalResponse;
  } else {
    return response;
  }
};

module.exports = {
  formatUserResponse,
};
