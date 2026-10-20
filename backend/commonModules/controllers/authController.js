const { User, generateResetToken } = require("@models/UserModel");
const mongoose = require("mongoose");
const moment = require("moment-timezone");
const Baby = require("@models/Baby");
const { sendResponse, validateParams } = require("@utils/responseUtil");
const { formatUserResponse } = require("@utils/userResponseUtil");
const { sendOtpEmail } = require("@utils/emailUtil");
const { createOrSkipDevice, Devices } = require("@models/Devices");
const validator = require("validator");
const bcrypt = require("bcryptjs");
const { babyPopulate, getBabyInfo } = require("@utils/babyUtil");
const { logActivity } = require("@utils/activityUtil");

const normalizeRole = (role) => {
  if (!role) {
    return "user";
  }

  return role === "admin" ? "admin" : "user";
};

const canAssignStaffRole = (req) => {
  const adminToken = req.header("x-admin-access-token");
  return adminToken && adminToken === process.env.ADMIN_ACCESS_TOKEN;
};

const getFormattedUserResponse = async (user, token = null) => {
  const refreshedUser = await User.findById(user._id);
  return formatUserResponse(refreshedUser || user, token);
};
const register = async (req, res) => {
  try {
    const requestedRole = normalizeRole(req.body.role);

    const isAdminSignup = requestedRole === "admin" && canAssignStaffRole(req);

    const validationOptions = {
      rawData: isAdminSignup
        ? ["name", "email", "password"]
        : [
            "name",
            "phoneNumber",
            "parentCaregiverName",
            "email",
            "password",
            "timezone",
            "deviceId",
            "deviceType",
          ],
      minLengthFields: {
        password: 6,
      },
    };
    if (!validateParams(req, res, validationOptions)) {
      return;
    }

    const {
      profileIcon = "",
      name,
      phoneNumber,
      parentCaregiverName,
      email,
      password,
      timezone,
      language = "en",
      deviceId,
      deviceType,
    } = req.body;

    if (
      !isAdminSignup &&
      !validator.isMobilePhone(phoneNumber, "any", {
        strictMode: true,
      })
    ) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "invalid_phoneNumber",
      });
    }

    if (!validator.isEmail(String(email || "").trim())) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "email_invalid",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const assignedRole = isAdminSignup ? "admin" : "user";
    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      if (existingUser.verificationStatus.email === "verified") {
        return sendResponse({
          res,
          statusCode: 409,
          translationKey: "email_already",
        });
      }

      if (existingUser.verificationStatus.email === "pending") {
        existingUser.name = name;

        existingUser.password = password;

        existingUser.phoneNumber = isAdminSignup ? undefined : phoneNumber;

        existingUser.parentCaregiverName = isAdminSignup
          ? undefined
          : parentCaregiverName;

        existingUser.profileIcon = profileIcon;

        existingUser.timezone = timezone || "Asia/Karachi";

        existingUser.language = language;

        existingUser.accountState.userType = assignedRole;

        existingUser.verificationStatus.email = "pending";

        existingUser.verificationStatus.phoneNumber = isAdminSignup
          ? "verified"
          : "pending";

        const otp = existingUser.generateOtp("email", existingUser.timezone);

        await existingUser.save();
        await sendOtpEmail(existingUser.email, otp);

        if (deviceId && deviceType) {
          await createOrSkipDevice(existingUser._id, deviceId, deviceType);
        }

        const token = existingUser.generateAuthToken();

        const response = await getFormattedUserResponse(existingUser, token);

        logActivity({
          user: existingUser._id,
          userType: existingUser.accountState.userType,
          action: "User Signed Up",
          detail: `${existingUser.name} re-submitted signup (pending verification)`,
          module: "auth",
          targetId: existingUser._id,
        });

        return sendResponse({
          res,

          statusCode: 201,

          translationKey: "signup_successful",

          data: {
            ...response,

            otp,
          },
        });
      }
    }

    const user = await User.create({
      email: normalizedEmail,
      name,
      password,
      phoneNumber: isAdminSignup ? undefined : phoneNumber,
      profileIcon,
      parentCaregiverName: isAdminSignup ? undefined : parentCaregiverName,
      timezone: timezone || "Asia/Karachi",
      language,
      verificationStatus: {
        email: "pending",
        phoneNumber: isAdminSignup ? "verified" : "pending",
      },
      accountState: {
        userType: assignedRole,
        status: isAdminSignup ? "active" : "active",
      },
    });

    const otp = user.generateOtp("email", timezone);
    await user.save();
    await sendOtpEmail(user.email, otp);
    if (deviceId && deviceType) {
      await createOrSkipDevice(user._id, deviceId, deviceType);
    }

    const token = user.generateAuthToken();
    const response = await getFormattedUserResponse(user, token);

    logActivity({
      user: user._id,
      userType: user.accountState.userType,
      action: isAdminSignup ? "Admin Signed Up" : "User Signed Up",
      detail: `${user.name} created a${isAdminSignup ? "n admin" : ""} account`,
      module: "auth",
      targetId: user._id,
    });

    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "signup_successful",
      data: {
        ...response,
        otp,
      },
    });
  } catch (error) {
    const statusCode = error.name === "ValidationError" ? 400 : 500;
    const translationKey =
      error.name === "ValidationError"
        ? Object.values(error.errors)[0].message
        : error.message;

    return sendResponse({
      res,
      statusCode,
      translationKey,
      error,
    });
  }
};

const login = async (req, res) => {
  try {
    const { email, password, deviceId, deviceType, language, timezone } =
      req.body;

    const validationOptions = {
      rawData: [
        "email",
        "password",
        "deviceId",
        "deviceType",
        "language",
        "timezone",
      ],
    };

    if (!validateParams(req, res, validationOptions)) {
      return;
    }

    const user = await User.findByCredentials(email, password);

    if (user.error) {
      if (user.error === "user_not_found") {
        return sendResponse({
          res,
          statusCode: 404,
          translationKey: "user_not_found",
        });
      }

      if (user.error === "incorrect_password") {
        return sendResponse({
          res,
          statusCode: 401,
          translationKey: "incorrect_password",
        });
      }
    }

    if (
      user.accountState?.status === "restricted" ||
      user.accountState?.status === "suspended"
    ) {
      return sendResponse({
        res,
        statusCode: 401,
        translationKey: "your_account_2",
      });
    }

    const verificationStatus = user.verificationStatus?.email;

    if (verificationStatus === "pending") {
      const otp = user.generateOtp("email", user.timezone);

      await user.save();
      await sendOtpEmail(user.email, otp);

      return sendResponse({
        res,

        statusCode: 403,

        translationKey: "your_account",

        data: {
          otp,
        },
      });
    }

    await createOrSkipDevice(user._id, deviceId, deviceType);

    let shouldSave = false;

    if (language && user.language !== language) {
      user.language = language;
      shouldSave = true;
    }

    if (timezone && user.timezone !== timezone) {
      user.timezone = timezone;
      shouldSave = true;
    }

    if (shouldSave) {
      await user.save();
    }

    const token = user.generateAuthToken();

    let activeBaby = null;

    if (user.activeBaby) {
      activeBaby = await Baby.findById(user.activeBaby).populate(babyPopulate);
    }

    const response = formatUserResponse(user, token, [], ["resetToken"]);

    response.babyInfo = activeBaby ? getBabyInfo(activeBaby) : null;

    response.hasBaby = !!activeBaby;

    logActivity({
      user: user._id,
      userType: user.accountState.userType,
      action:
        user.accountState.userType === "admin"
          ? "Admin Logged In"
          : "User Logged In",
      detail: `${user.name} logged in`,
      module: "auth",
      targetId: user._id,
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "login_success",
      data: response,
    });
  } catch (error) {
    console.error("Login Error:", error);

    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error.message,
    });
  }
};

const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "user_not",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: formatUserResponse(user),
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: error.message,
      error,
    });
  }
};

const generateOtp = async (req, res) => {

  try {
    const { email, phoneNumber, type } = req.body;
    const validationOptions = {
      rawData: [type === "email" ? "email" : "phoneNumber"],
    };
    if (!validateParams(req, res, validationOptions)) {
      return;
    }

    if (
      type === "phoneNumber" &&
      phoneNumber &&
      !validator.isMobilePhone(phoneNumber, "any", { strictMode: true })
    ) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "invalid_phone",
      });
    }

    let user;
    if (type === "email") {
      user = await User.findOne({ email: email.toLowerCase() }).select(
        "email accountState otpInfo",
      );
    } else if (type === "phoneNumber") {
      user = await User.findOne({ phoneNumber }).select(
        "phoneNumber accountState otpInfo",
      );
    }

    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "user_not",
      });
    }

    if (["restricted", "suspended"].includes(user.accountState.status)) {
      return sendResponse({
        res,
        statusCode: 403,
        translationKey: "your_account_4",
      });
    }

    const otp = user.generateOtp(type, user.timezone);

    if (otp.error) {
      if (otp.error === "too_many_otp_requests") {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey: "too_many_otp_requests",
        });
      }
    }

    await user.save();

    if (type === "email") {
      await sendOtpEmail(user.email, otp);
    }

    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "otp_generated",
      data: { otp },
    });
  } catch (error) {

    return sendResponse({
      res,
      statusCode: 500,
      translationKey: error.message,
      error: error,
    });
  }
};

const verifyOtp = async (req, res) => {

  try {
    const { email, phoneNumber, type, otp } = req.body;
    const validationOptions = {
      rawData: [type === "email" ? "email" : "phoneNumber"],
    };
    if (type === "email") {
      validationOptions.rawData.push("otp");
    }
    if (!validateParams(req, res, validationOptions)) {
      return;
    }

    if (
      type === "phoneNumber" &&
      phoneNumber &&
      !validator.isMobilePhone(phoneNumber, "any", { strictMode: true })
    ) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "invalid_phone",
      });
    }

    let user;
    if (type === "email") {
      user = await User.findOne({ email: email.toLowerCase() }).select(
        "email accountState otpInfo verificationStatus timezone",
      );
    } else if (type === "phoneNumber") {
      user = await User.findOne({ phoneNumber }).select(
        "phoneNumber accountState otpInfo verificationStatus timezone",
      );
    }

    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "user_not",
      });
    }

    const userOtpInfo =
      type === "email" ? user.otpInfo.emailOtp : user.otpInfo.phoneNumberOtp;

    if (type === "email") {
      if (userOtpInfo.otp !== otp.toString()) {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey: "invalid_otp",
        });
      }

      const currentTime = moment.tz(Date.now(), user.timezone).valueOf();
      if (userOtpInfo.otpExpires && userOtpInfo.otpExpires < currentTime) {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey: "otp_has",
        });
      }
    }

    userOtpInfo.otp = "";
    userOtpInfo.otpExpires = "";
    userOtpInfo.otpUsed = true;
    user.verificationStatus[type] = "verified";

    const resetToken = generateResetToken();
    user.resetToken = resetToken;

    await user.save();

    const updatedUser = await User.findById(user._id);

    const token = user.generateAuthToken();

    const response = formatUserResponse(updatedUser, token);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "otp_verified",
      data: {
        ...response,
        resetToken: user.resetToken,
      },
    });
  } catch (error) {
    console.error("Error during OTP verification:", error);
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "an_error",
      error: error,
    });
  }
};

const forgetPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const validationOptions = {
      rawData: ["email"],
    };

    if (!validateParams(req, res, validationOptions)) {
      return;
    }

    if (!validator.isEmail(String(email || "").trim())) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "email_invalid",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "user_not_found",
      });
    }

    if (["restricted", "suspended"].includes(user.accountState?.status)) {
      return sendResponse({
        res,
        statusCode: 403,
        translationKey: "your_account_4",
      });
    }

    const otp = user.generateOtp("email", user.timezone || "Asia/Karachi");

    if (otp?.error === "too_many_otp_requests") {
      return sendResponse({
        res,
        statusCode: 429,
        translationKey: "too_many_otp_requests",
      });
    }

    await user.save();

    await sendOtpEmail(normalizedEmail, otp, "forgot-password");

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "otp_sent_successfully",
      data: {
        otp,
      },
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: error.message,
      error,
    });
  }
};

const resetPassword = async (req, res) => {
  try {
    const { email, newPassword, resetToken } = req.body;

    const validationOptions = {
      rawData: ["email", "newPassword", "resetToken"],
    };
    if (!validateParams(req, res, validationOptions)) {
      return;
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase(),
      resetToken: resetToken,
    });

    if (!user) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "no_valid",
      });
    }

    user.password = newPassword;
    user.otpInfo.otpUsed = true;
    user.otpInfo.otp = "";
    user.otpInfo.otpExpires = "";
    user.resetToken = "";

    await user.save();

    const [updatedUser, token] = await Promise.all([
      User.findById(user._id),
      user.generateAuthToken(),
    ]);

    const response = formatUserResponse(updatedUser, token);

    logActivity({
      user: user._id,
      userType: user.accountState.userType,
      action: "Password Reset",
      detail: `${user.name} reset their password via OTP`,
      module: "auth",
      targetId: user._id,
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "password_has",
      data: response,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "an_error_1",
      error: error,
    });
  }
};

const logout = async (req, res) => {
  try {
    const { deviceId } = req.body;
    const userId = req.user._id;

    if (deviceId) {
      await Devices.updateOne(
        { userId: userId },
        { $pull: { devices: { deviceId: deviceId } } },
      );
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "logged_out",
    });
  } catch (err) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: err.message,
      error: err.message,
    });
  }
};
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;
    const email = req.user.email;

    const randomEmail = `deleted_user_${userId}_${Date.now()}@example.com`;

    await User.findByIdAndUpdate(
      userId,
      {
        $set: {
          email: randomEmail,
          previousEmail: email,
          "accountState.status": "sotDeleted",
          "accountState.finalDeletionDate": new Date(),
        },
      },
      { new: true },
    );

    await Devices.updateOne(
      { userId: userId },
      { $set: { devices: [] } },
    );

    logActivity({
      user: userId,
      userType,
      action: "Account Deleted",
      detail: `${email} deleted their account`,
      module: "auth",
      targetId: userId,
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "account_deleted",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: error.message,
      error: error,
    });
  }
};

const socialAuth = async (req, res) => {
  const { provider, socialId, email, name, deviceId, deviceType, timezone } =
    req.body;

  try {
    const validationOptions = {
      rawData: [
        "provider",
        "socialId",
        "email",
        "name",
        "deviceId",
        "deviceType",
        "timezone",
      ],
      enumFields: {
        provider: ["google", "facebook", "apple"],
      },
    };

    if (!validateParams(req, res, validationOptions)) {
      return;
    }

    const existingUser = await User.findOne({ email });

    if (existingUser) {
      let providerLinked = false;

      if (
        existingUser.accountState.status === "restricted" ||
        existingUser.accountState.status === "suspended"
      ) {
        return sendResponse({
          res,
          statusCode: 403,
          translationKey: "your_account_2",
        });
      }

      if (provider === "google" && !existingUser.googleId) {
        existingUser.googleId = socialId;
        providerLinked = true;
      } else if (provider === "facebook" && !existingUser.facebookId) {
        existingUser.facebookId = socialId;
        providerLinked = true;
      } else if (provider === "apple" && !existingUser.appleId) {
        existingUser.appleId = socialId;
        providerLinked = true;
      }

      existingUser.provider = provider;
      existingUser.timezone = timezone;
      existingUser.accountState.status = "active";
      existingUser.name = name;
      existingUser.parentCaregiverName = name;

      await existingUser.save();

      await createOrSkipDevice(existingUser._id, deviceId, deviceType);
      const token = existingUser.generateAuthToken();

      let activeBaby = null;

      if (existingUser.activeBaby) {
        activeBaby = await Baby.findById(existingUser.activeBaby).populate(
          babyPopulate,
        );
      }

      const response = formatUserResponse(
        existingUser,
        token,
        [],
        ["resetToken"],
      );

      response.babyInfo = activeBaby ? getBabyInfo(activeBaby) : null;
      response.hasBaby = !!activeBaby;

      logActivity({
        user: existingUser._id,
        userType: existingUser.accountState.userType,
        action: "User Logged In",
        detail: `${existingUser.name} logged in via ${provider}${providerLinked ? " (newly linked)" : ""}`,
        module: "auth",
        targetId: existingUser._id,
        metadata: { provider },
      });

      return sendResponse({
        res,
        statusCode: 200,
        translationKey: "login_success",
        data: response,
      });
    } else {
      const newUser = new User({
        email,
        name,
        parentCaregiverName: name,
        provider,
        [`${provider}Id`]: socialId,
        timezone,
        verificationStatus: {
          email: "verified",
        },
        accountState: {
          userType: "user",
          status: "active",
        },
      });

      await newUser.save();

      await createOrSkipDevice(newUser._id, deviceId, deviceType);
      const token = newUser.generateAuthToken();

      const response = formatUserResponse(newUser, token, [], ["resetToken"]);

      response.babyInfo = null;
      response.hasBaby = false;

      logActivity({
        user: newUser._id,
        userType: newUser.accountState.userType,
        action: "User Signed Up",
        detail: `${newUser.name} signed up via ${provider}`,
        module: "auth",
        targetId: newUser._id,
        metadata: { provider },
      });

      return sendResponse({
        res,
        statusCode: 201,
        translationKey: "signup_successful",
        data: response,
      });
    }
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: error.message,
      error: error,
    });
  }
};

const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (
      !validateParams(req, res, {
        rawData: ["currentPassword", "newPassword"],
        minLengthFields: {
          newPassword: 6,
        },
      })
    )
      return;

    const user = await User.findById(req.user._id);

    if (!user) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "user_not_found",
      });
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      user.password,
    );

    if (!isCurrentPasswordValid) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "current_password_incorrect",
      });
    }

    const isSamePassword = await bcrypt.compare(newPassword, user.password);

    if (isSamePassword) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "new_password_should_not_be_same_as_current",
      });
    }

    user.password = newPassword;

    await user.save();

    logActivity({
      user: user._id,
      userType: user.accountState.userType,
      action: "Password Changed",
      detail: `${user.name} changed their password`,
      module: "auth",
      targetId: user._id,
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "password_changed_successfully",
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
  register,
  login,
  getMe,
  generateOtp,
  verifyOtp,
  forgetPassword,
  resetPassword,
  logout,
  deleteAccount,
  socialAuth,
  changePassword,
};
