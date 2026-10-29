const {
  sendEmailViaSgrid,
  sendEmailViaAwsSes,
  sendSmsViaPinpoint,
  sendEmailViaBrevo,
} = require("@utils/emailUtil");
const { Devices } = require("@models/Devices");
const { sendResponse, validateParams } = require("@utils/responseUtil");
const adminFireBConfig = require("@config/firebaseAdmin");
const { registrationOtpEmailTemplate } = require("@utils/emailTemplates");
const { NotificationExp } = require("@models/Notifications");
const { Vonage } = require("@vonage/server-sdk");

/**
 * Send an email using SendGrid
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const sendEmailSgrid = async (req, res) => {
  const { title, emails, subject, body, config } = req.body;

  const validationOptions = {
    bodyParams: ["title", "emails", "subject", "body"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return;
  }

  try {
    await sendEmailViaSgrid(title, emails, subject, body, config);
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "email_sent",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: error.body,
      error,
    });
  }
};

/**
 * Send an email using AWS SES
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const sendEmailAws = async (req, res) => {
  const { title, emails, subject, body, config } = req.body;

  const validationOptions = {
    bodyParams: ["title", "emails", "subject", "body"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return;
  }

  try {
    await sendEmailViaAwsSes(emails, subject, body, config);
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "email_sent",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "failed_to",
      error: error,
    });
  }
};
/**
 * Send an email using AWS SES
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const sendEmailBrevo = async (req, res) => {
  const { title, emails, subject, body, config } = req.body;
  const validationOptions = {
    bodyParams: ["title", "emails", "subject", "body"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return;
  }

  try {
    await sendEmailViaBrevo(emails, subject, body, config);
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "email_sent",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "failed_to",
      error: error,
    });
  }
};

const sendSmsViaPinpointAws = async (req, res) => {
  const { phoneNumber, otp } = req.body;

  if (!phoneNumber || !otp) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: "phone_number_1",
      error: "Phone number and OTP are required.",
    });
  }

  try {
    const otpMessage = `${otp} is your OTP for the boilerplate App`;
    await sendSmsViaPinpoint(phoneNumber, otpMessage);
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "otp_sent",
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: error.body,
      error,
    });
  }
};

/**
 * Send a notification (placeholder function, can be expanded for different titles)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const sendNotificationControllerForTesting = async (req, res) => {
  const { recipients, title, body, data } = req.body;

  const validationOptions = {
    bodyParams: ["recipients", "title", "body"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return;
  }

  try {

    const results = await sendNotification(recipients, {
      title: title,
      body: body,
      data: toFcmData(data || {}),
    });

    const successIds = results.filter((r) => r.success).map((r) => r.token);
    const failureIds = results
      .filter((r) => !r.success)
      .map((r) => ({ token: r.token, error: r.errorCode || "Unknown error" }));

    if (successIds.length > 0) {
      return sendResponse({
        res,
        statusCode: 200,
        translationKey: "notifications_sent_success",
        values: { title },
        data: {
          successIds,
          failureIds,
        },
      });
    } else {
      return sendResponse({
        res,
        statusCode: 500,
        translationKey: "notifications_sent_failure",
        values: { title },
        data: {
          successIds,
          failureIds,
        },
      });
    }
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: error.message,
      error,
    });
  }
};

/** FCM `data` payloads only accept string values. */
const toFcmData = (data) =>
  Object.fromEntries(
    Object.entries(data).map(([k, v]) => [
      k,
      v == null ? "" : typeof v === "string" ? v : String(v),
    ]),
  );

const isFirebaseReady = () => adminFireBConfig.apps.length > 0;

// FCM error codes meaning the token will never work again.
const DEAD_TOKEN_CODES = [
  "messaging/registration-token-not-registered",
  "messaging/invalid-registration-token",
  "messaging/invalid-argument",
];

/**
 * Saves an in-app notification for each recipient and pushes it to their registered devices.
 * The in-app notification is stored even when push fails (no devices, Firebase not configured, bad tokens).
 *
 * @param {Object} param0 - recipientIds (array), title, body, optional data / sender / objectId.
 */
const sendUserNotifications = async ({
  recipientIds,
  title,
  body,
  data = {},
  sender = null,
  objectId = null,
  saveNotification = true,
}) => {
  setImmediate(async () => {
    try {
      if (saveNotification) {
        await NotificationExp.insertMany(
          recipientIds.map((receiverId) => ({
            type: data.type || "system",
            subjectId: sender,
            objectId,
            objectType: data.objectType,
            receiverId,
            title,
            body,
          })),
        );
      }

      if (!isFirebaseReady()) {
        console.warn("Push skipped — Firebase Admin is not configured.");
        return;
      }

      const recipientDevices = await Devices.find({
        userId: { $in: recipientIds },
      }).select("userId devices");

      const pushData = toFcmData({
        ...data,
        subjectId: sender,
        objectId,
      });

      for (const userDevice of recipientDevices) {
        if (!userDevice.devices.length) continue;
        try {
          const results = await sendNotification(userDevice.devices, {
            title,
            body,
            data: pushData,
          });
          const deadTokens = results
            .filter((r) => !r.success && DEAD_TOKEN_CODES.includes(r.errorCode))
            .map((r) => r.token);
          if (deadTokens.length) {
            await Devices.updateOne(
              { _id: userDevice._id },
              { $pull: { devices: { deviceId: { $in: deadTokens } } } },
            );
          }
        } catch (error) {
          console.error(`Push to user ${userDevice.userId} failed:`, error.message);
        }
      }
    } catch (error) {
      console.error("Error sending notifications in background:", error);
    }
  });
};

/**
 * Sends one push to every device; returns `{ token, success, errorCode }` per device.
 */
const sendNotification = async (recipients, payload) => {
  const byPlatform = { android: [], ios: [] };
  recipients.forEach((recipient) => {
    if (recipient.deviceId && byPlatform[recipient.deviceType]) {
      byPlatform[recipient.deviceType].push(recipient.deviceId);
    }
  });

  const notification = { title: payload.title, body: payload.body };
  const messages = {
    android: {
      notification,
      data: payload.data,
      android: { priority: "high", notification: { sound: "default" } },
    },
    ios: {
      notification,
      data: payload.data,
      apns: { payload: { aps: { sound: "default", badge: 1 } } },
    },
  };

  const results = [];
  for (const platform of ["android", "ios"]) {
    const tokens = byPlatform[platform];
    if (!tokens.length) continue;
    const response = await adminFireBConfig
      .messaging()
      .sendEachForMulticast({ tokens, ...messages[platform] });
    response.responses.forEach((r, i) =>
      results.push({
        token: tokens[i],
        success: r.success,
        errorCode: r.error?.code,
      }),
    );
  }
  return results;
};

const vonage = new Vonage({
  apiKey: process.env.VONAGE_API_KEY,
  apiSecret: process.env.VONAGE_API_SECRET,
});

const sendSmsViaVonage = async (req, res) => {
  const { phoneNumber, otp } = req.body;

  if (!phoneNumber || !otp) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: "phone_number_1",
      error: "Phone number and OTP are required.",
    });
  }

  try {
    const otpMessage = `${otp} is your OTP for the ZahraPay App`;
    const from = "+921234567890";

    const messageData = {
      to: phoneNumber,
      from: from,
      text: otpMessage,
    };

    vonage.sms.send(messageData, (err, responseData) => {
      console.log("Entered the callback function");
      if (err) {
        console.error("Error sending SMS:", err);
        return sendResponse({
          res,
          statusCode: 500,
          translationKey: "Error sending SMS via Vonage",
          error: err.message,
        });
      } else {
        console.log("Response data:", responseData);
        if (
          responseData &&
          responseData.messages &&
          responseData.messages[0].status === "0"
        ) {
          console.log("Message sent successfully:", responseData);
          return sendResponse({
            res,
            statusCode: 200,
            translationKey: "otp_sent",
            data: responseData,
          });
        } else {
          console.error(
            "Failed to send message. Status:",
            responseData.messages[0].status,
          );
          return sendResponse({
            res,
            statusCode: 500,
            translationKey: "otp_sent",
            error: `Failed with status: ${responseData.messages[0].status}`,
          });
        }
      }
    });
  } catch (error) {
    console.error("Error sending SMS:", error);
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: error.message || "otp_sent",
      error: error.message,
    });
  }
};

const axios = require("axios");

const sendSMSSomalianAPI = async (req, res) => {
  const { phoneNumber, otp } = req.body;
  const message = `Your OTP is ${otp}`;

  if (!phoneNumber || !otp) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: "phone_number_1",
      error: "Phone number and message are required.",
    });
  }

  try {
    const apiKey = "07098f01-6071-4045-abd8-63a7ec3e25ac";
    const apiSecret = "5810f9db-bd8e-4002-ab57-721ab0d8ee1e";

    const accountApiCredentials = `${apiKey}:${apiSecret}`;

    const buff = Buffer.from(accountApiCredentials);
    const base64Credentials = buff.toString("base64");

    const requestHeaders = {
      headers: {
        Authorization: `Basic ${base64Credentials}`,
        "Content-Type": "application/json",
      },
    };

    const requestData = JSON.stringify({
      messages: [
        {
          content: message,
          destination: phoneNumber,
        },
      ],
    });

    const response = await axios.post(
      "https://rest.mymobileapi.com/bulkmessages",
      requestData,
      requestHeaders,
    );

    if (response.data) {
      console.log("Success:", response.data);
      return sendResponse({
        res,
        statusCode: 200,
        translationKey: "otp_sent",
        data: response.data,
      });
    }
  } catch (error) {
    console.error("Error sending SMS:", error);
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: error.message || "otp_sent",
      error: error.message,
    });
  }
};

module.exports = {
  sendEmailSgrid,
  sendEmailAws,
  sendSmsViaPinpointAws,
  sendNotificationControllerForTesting,
  sendUserNotifications,
  sendSmsViaVonage,
  sendSMSSomalianAPI,
  sendEmailBrevo,
};
