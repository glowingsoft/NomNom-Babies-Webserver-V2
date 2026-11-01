const sgMail = require("@sendgrid/mail");
const { SESClient, SendEmailCommand } = require("@aws-sdk/client-ses");
const {
  PinpointClient,
  SendMessagesCommand,
} = require("@aws-sdk/client-pinpoint");

var SibApiV3Sdk = require("sib-api-v3-sdk");

const DEFAULT_APP_NAME = "NomNom Babies";
const EMAIL_LOGO_CID = "nomnom-logo";

/**
 * Templates reference the logo as <img src="cid:nomnom-logo">. Email clients can't
 * load files from our server, so the logo is attached inline when a body uses it.
 * If the logo can't be prepared, the image tag is swapped for the brand name.
 */
const withInlineLogo = async (body, attachments = []) => {
  if (typeof body !== "string" || !body.includes(`cid:${EMAIL_LOGO_CID}`)) {
    return { body, attachments };
  }

  const { getLogo } = require("./downloadPdf/logo");
  const logo = await getLogo();

  if (!logo) {
    return {
      body: body.replace(
        new RegExp(`<img[^>]*cid:${EMAIL_LOGO_CID}[^>]*>`, "g"),
        `<span style="font-size:22px;font-weight:bold;color:#F2692B;">${DEFAULT_APP_NAME}</span>`,
      ),
      attachments,
    };
  }

  return {
    body,
    attachments: [
      ...attachments,
      {
        content: logo.toString("base64"),
        filename: "nomnom-logo.png",
        type: "image/png",
        disposition: "inline",
        content_id: EMAIL_LOGO_CID,
      },
    ],
  };
};

const sesClient = new SESClient({
  region: process.env.AWS_EMAIL_REGION,
  credentials: {
    accessKeyId: process.env.AWS_EMAIL_SECRET_ID,
    secretAccessKey: process.env.AWS_EMAIL_SECRET_KEY,
  },
});

/**
 * Send an email using AWS SES
 * @param {string} title - The title of the email (usually appears as the "from" name)
 * @param {Array} emails - List of recipient email addresses
 * @param {string} subject - Subject of the email
 * @param {string} body - Body of the email (HTML or plain text)
 * @param {Object} [config] - Additional configuration options (optional)
 * @param {string} [config.fromEmail] - From email address (default is set by AWS SES)
 * @param {Object} [config.attachments] - Attachments for the email (AWS SES supports raw email for attachments)
 * @param {boolean} [config.isHtml] - Flag to indicate if the body is HTML
 * @returns {Promise} - Promise resolving to AWS SES response or rejecting with an error
 */
const sendEmailViaAwsSes = async (emails, subject, body, config = {}) => {
  try {
    const {
      fromEmail = `biolderPlate"; App <${process.env.AWS_SENDER_EMAIL}>`,
      isHtml = true,
    } = config;

    const params = {
      Source: fromEmail,
      Destination: {
        ToAddresses: emails,
      },
      Message: {
        Subject: {
          Data: subject,
        },
        Body: {
          [isHtml ? "Html" : "Text"]: {
            Data: body,
          },
        },
      },
    };

    const command = new SendEmailCommand(params);
    const response = await sesClient.send(command);
    return response;
  } catch (error) {
    console.error("Error sending email via AWS SES:", error);
    throw error;
  }
};

const pinpointClient = new PinpointClient({
  region: process.env.AWS_EMAIL_REGION,
  credentials: {
    accessKeyId: process.env.AWS_EMAIL_SECRET_ID,
    secretAccessKey: process.env.AWS_EMAIL_SECRET_KEY,
  },
});

/**
 * Send an SMS using Amazon Pinpoint
 * @param {string} phoneNumber - The recipient's phone number in E.164 format (+1234567890)
 * @param {string} message - The SMS message content
 * @returns {Promise} - A promise that resolves to the result of the Pinpoint SendMessagesCommand
 */
const sendSmsViaPinpoint = async (phoneNumber, message) => {
  try {
    const params = {
      ApplicationId: process.env.AWS_PINPOINT_APP_ID,
      MessageRequest: {
        Addresses: {
          [phoneNumber]: {
            ChannelType: "SMS",
          },
        },
        MessageConfiguration: {
          SMSMessage: {
            Body: message,
            MessageType: "TRANSACTIONAL",
            SenderId: process.env.AWS_PINPOINT_SENDER_ID,
          },
        },
      },
    };

    const command = new SendMessagesCommand(params);
    const response = await pinpointClient.send(command);
    console.log("SMS sent successfully:", response);
    return response;
  } catch (error) {
    console.error("Error sending SMS via Amazon Pinpoint:", error);
    throw error;
  }
};

/**
 * Send an email using SendGrid
 * @param {string} title - The title of the email (usually appears as the "from" name)
 * @param {Array} emails - List of recipient email addresses
 * @param {string} subject - Subject of the email
 * @param {string} body - Body of the email (HTML or plain text)
 * @param {Object} [config] - Additional configuration options (optional)
 * @param {string} [config.fromEmail] - From email address (default is set by SendGrid)
 * @param {Object} [config.attachments] - Attachments for the email
 * @param {boolean} [config.isHtml] - Flag to indicate if the body is HTML
 * @returns {Promise} - Promise resolving to SendGrid response or rejecting with an error
 */
const sendEmailViaSgrid = async (title, emails, subject, body, config = {}) => {
  try {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);

    const emailTitle = title || DEFAULT_APP_NAME;

    const {
      fromEmail = process.env.SENDGRID_SENDER_EMAIL,
      attachments: baseAttachments = [],
      isHtml = true,
    } = config;

    const { body: finalBody, attachments } = isHtml
      ? await withInlineLogo(body, baseAttachments)
      : { body, attachments: baseAttachments };

    const msg = {
      to: emails,
      from: {
        email: fromEmail,
        name: emailTitle,
      },
      subject: subject,
      [isHtml ? "html" : "text"]: finalBody,
      attachments: attachments,
    };
    console.log(msg);

    const response = await sgMail.send(msg);
    return response;
  } catch (error) {
    console.error("Error sending email via sGrid:", error);
    throw error;
  }
};

const sendEmailViaBrevo = async (emails, subject, body, config = {}) => {
  var defaultClient = SibApiV3Sdk.ApiClient.instance;
  var apiKey = defaultClient.authentications["api-key"];
  apiKey.apiKey = process.env.BREVO_EMAIL_API_KEY;

  const apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
  const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();
  sendSmtpEmail.subject = subject;
  sendSmtpEmail.htmlContent = body;
  sendSmtpEmail.sender = { email: "support@boilerplateapp.com", name: "boilerplate Support" };

  sendSmtpEmail.to = emails.map(email => ({ email }));
  try {
   const data = await apiInstance.sendTransacEmail(sendSmtpEmail);
    console.log("Email paused in dev environment", data);
  } catch (error) {
    console.error("Error sending email:", error);
  }
};

/**
 * Email an OTP to a user via SendGrid. Never throws: a mail failure is logged
 * so it cannot break the API call that generated the OTP.
 * @param {string} email - Recipient email address
 * @param {string} otp - The generated OTP (non-string values, e.g. { error }, are ignored)
 * @param {"verification"|"forgot-password"} [purpose="verification"]
 * @returns {Promise<boolean>} true if SendGrid accepted the email
 */
const sendOtpEmail = async (email, otp, purpose = "verification") => {
  if (!email || typeof otp !== "string") return false;
  const {
    registrationOtpEmailTemplate,
    forgotPasswordOtpEmailTemplate,
  } = require("./emailTemplates");
  const isReset = purpose === "forgot-password";
  try {
    await sendEmailViaSgrid(
      DEFAULT_APP_NAME,
      [email],
      isReset ? "Reset your NomNom Babies password" : "Verify your NomNom Babies account",
      isReset ? forgotPasswordOtpEmailTemplate(otp) : registrationOtpEmailTemplate(otp),
    );
    return true;
  } catch (error) {
    console.error("Failed to send OTP email:", error?.response?.body || error.message);
    return false;
  }
};

module.exports = {
  sendOtpEmail,
  sendEmailViaAwsSes,
  sendSmsViaPinpoint,
  sendEmailViaSgrid,
  sendEmailViaBrevo,
};
