const ContactUs = require("@models/ContactUs");
const {
  sendResponse,
  validateParams,
  parsePaginationParams,
  generateMeta,
} = require("@utils/responseUtil");
const validator = require("validator");
const { sendEmailViaBrevo } = require("@utils/emailUtil");
const { config } = require("dotenv");

const createContactRequest = async (req, res) => {
  const { name, email, phoneNumber, description } = req.body;

  const validationOptions = {
    rawData: ["name", "email", "description"],
  };

  if (!validateParams(req, res, validationOptions)) {
    return;
  }

  if (
    phoneNumber &&
    !validator.isMobilePhone(phoneNumber, "any", { strictMode: true })
  ) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: "invalid_phone",
    });
  }

  try {
    const contactRequest = new ContactUs({
      name,
      email,
      phoneNumber,
      description,
      status: "pending",
    });

    const subject = "Contact Us Request by " + name;
    const mDescription = phoneNumber
      ? `${description} \n Name: ${name} \n Email: ${email} \n Phone Number: ${phoneNumber}`
      : `${description} \n Name: ${name} \n Email: ${email}`;

    const supportEmail = process.env.SUPPORT_EMAIL;

    await Promise.all([
      contactRequest.save(),
    ]);

    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "contact_request",
    });
  } catch (error) {

    if (error.name === "ValidationError") {
      const errorMessages = Object.values(error.errors).map(
        (err) => err.message
      );
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: errorMessages[0],
        error: error,
      });
    }

    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error,
    });
  }
};

module.exports = {
  createContactRequest,
};
