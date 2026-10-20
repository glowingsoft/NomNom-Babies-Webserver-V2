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

    const response = await sendNotification(recipients, {
      title: title,
      body: body,
      data: data,
    });

    const successIds = [];
    const failureIds = [];

    response.responses.forEach((resp, idx) => {
      if (resp.success) {
        successIds.push(recipients[idx]);
      } else {
        failureIds.push({
          ...recipients[idx],
          error: resp.error ? resp.error.message : "Unknown error",
        });
      }
    });

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

/**
 * Sends a notification to multiple users based on their user IDs.
 *
 * @param {Object} param0 - Object containing recipientIds (array), title (string), body (string), and optional data (object).
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
      const recipientDevices = await Devices.find({
        userId: { $in: recipientIds },
      }).select("userId devices");

      if (recipientDevices && recipientDevices.length > 0) {
        const flattenedDevices = recipientDevices.flatMap((userDevice) =>
          userDevice.devices.map((device) => ({
            userId: userDevice.userId,
            deviceId: device.deviceId,
            deviceType: device.deviceType,
          })),
        );

        const devicesByUser = flattenedDevices.reduce((acc, device) => {
          if (!acc[device.userId]) {
            acc[device.userId] = new Set();
          }
          acc[device.userId].add(device);
          return acc;
        }, {});
        const responses = [];

        for (const userId in devicesByUser) {
          const userDevices = Array.from(devicesByUser[userId]).map(
            (device) => ({
              deviceId: device.deviceId,
              deviceType: device.deviceType,
            }),
          );

          const sendNotificationPromise = sendNotification(userDevices, {
            title,
            body,
            data: {
              ...data,
              subjectId: sender ? sender.toString() : null,
              objectId: objectId.toString(),
            },
          });

          const sendNotificationResponse = await sendNotificationPromise;
          responses.push({ userId, sendNotificationResponse });
        }

        console.log(data);

        responses.forEach((response) => {
          console.log(
            `Response for user ${response.userId}:`,
            JSON.stringify(response.sendNotificationResponse, null, 2),
          );
        });

        if (!saveNotification) {
          return;
        }

        const notificationsToSave = responses.map(({ userId }) => ({
          type: data.type || "system",
          subjectId: sender,
          objectId: objectId,
          objectType: data.objectType,
          receiverId: userId,
          title,
          body,
        }));

        await NotificationExp.insertMany(notificationsToSave);
      } else {
        console.log("No devices found for the provided user IDs.");
      }
    } catch (error) {
      console.error("Error sending notifications in background:", error);
    }
  });
};

const sendNotification = async (recipients, payload) => {
  const androidTokens = [];
  const iosTokens = [];

  recipients.forEach((recipient) => {
    if (recipient.deviceType === "android") {
      androidTokens.push(recipient.deviceId);
    } else if (recipient.deviceType === "ios") {
      iosTokens.push(recipient.deviceId);
    }
  });

  const androidPayload = {
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: payload.data,
  };

  const iosPayload = {
    notification: {
      title: payload.title,
      body: payload.body,
    },
    apns: {
      payload: {
        aps: {
          alert: {
            title: payload.title,
            body: payload.body,
          },
          sound: "default",
          badge: 1,
        },
      },
    },
    data: payload.data,
  };

  try {
    const promises = [];

    if (androidTokens.length > 0) {
      const androidPromise = adminFireBConfig.messaging().sendEachForMulticast({
        tokens: androidTokens,
        ...androidPayload,
      });
      promises.push(androidPromise);
    }

    if (iosTokens.length > 0) {
      const iosPromise = adminFireBConfig.messaging().sendEachForMulticast({
        tokens: iosTokens,
        ...iosPayload,
      });
      promises.push(iosPromise);
    }

    const responses = await Promise.all(promises);

    const result = {
      responses: [],
    };

    responses.forEach((response) => {
      result.responses = result.responses.concat(response.responses);
    });
    return result;
  } catch (error) {
    console.error("Error sending notifications:", error);
    throw error;
  }
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
