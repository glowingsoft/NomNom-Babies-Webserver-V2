const AdminSettings = require("@models/Settings");
const {
  sendResponse,
  parsePaginationParams,
  generateMeta,
} = require("@utils/responseUtil");
const Faq = require("@models/Faq");
const { logActivity } = require("@utils/activityUtil");

const getSettingByKey = async (key) => {
  return await AdminSettings.findOne({ key });
};

// Get Terms and Conditions
const getTermsAndConditions = async (req, res) => {
  try {
    const settings = await getSettingByKey("termsConditions");
    if (!settings) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "terms_not_found",
      });
    }
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "terms_fetched_successfully",
      data: settings,
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

// Get About Us
const getAboutUs = async (req, res) => {
  try {
    const settings = await getSettingByKey("aboutUs");
    if (!settings) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "about_us_not_found",
      });
    }
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "about_us_fetched_successfully",
      data: settings,
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

// Get Privacy Policy
const getPrivacyPolicy = async (req, res) => {
  try {
    const settings = await getSettingByKey("privacyPolicy");
    if (!settings) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "privacy_policy_not_found",
      });
    }
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "privacy_policy_fetched_successfully",
      data: settings,
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

// Get FAQs
const getFaqs = async (req, res) => {
  try {
    const { page, limit } = parsePaginationParams(req);
    const { keyword } = req.query; // Get keyword from query

    // Initialize query object with base condition
    let queryConditions = {};
    // Apply keyword search on both `name` and `anonymousName` if keyword is provided
    if (keyword && keyword.trim() !== "") {
      queryConditions.$or = [
        { question: { $regex: keyword, $options: "i" } },
        { answer: { $regex: keyword, $options: "i" } },
      ];
    }

    const [faqs, totalRecords] = await Promise.all([
      Faq.find(queryConditions)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      Faq.countDocuments(queryConditions),
    ]);

    let meta = generateMeta(page, limit, totalRecords);
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "Faqs fetched successfully",
      data: faqs,
      meta,
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "something_went_wrong",
      error,
    });
  }
};

// Update About-Us
const updateAboutUs = async (req, res) => {
  try {
    const { title, content } = req.body;
    const settings = await AdminSettings.findOneAndUpdate(
      { key: "aboutUs" },
      { key: "aboutUs", title, content },
      { new: true, upsert: true },
    );
    void logActivity({
      user: req.user._id,
      userType: req.user.userType,
      action: "update",
      detail: "Updated About Us settings",
      module: "settings",
      targetId: settings._id,
      metadata: {
        key: settings.key,
        title: settings.title,
      },
    });
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "about_us_updated",
      data: settings,
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

// Update Privacy Policy
const updatePrivacyPolicy = async (req, res) => {
  try {
    const { title, content } = req.body;
    const settings = await AdminSettings.findOneAndUpdate(
      { key: "privacyPolicy" },
      { key: "privacyPolicy", title, content },
      { new: true, upsert: true },
    );
    void logActivity({
      user: req.user._id,
      userType: req.user.userType,
      action: "update",
      detail: "Updated Privacy Policy",
      module: "settings",
      targetId: settings._id,
      metadata: {
        key: settings.key,
        title: settings.title,
      },
    });
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "privacy_policy_updated",
      data: settings,
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

// Update Terms and Conditions
const updateTermsAndConditions = async (req, res) => {
  try {
    const { title, content } = req.body;
    const settings = await AdminSettings.findOneAndUpdate(
      { key: "termsConditions" },
      { key: "termsConditions", title, content },
      { new: true, upsert: true },
    );
    void logActivity({
      user: req.user._id,
      userType: req.user.userType,
      action: "update",
      detail: "Updated Terms and Conditions",
      module: "settings",
      targetId: settings._id,
      metadata: {
        key: settings.key,
        title: settings.title,
      },
    });
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "terms_and_conditions_updated",
      data: settings,
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

// Update FAQs
const updateFaqs = async (req, res) => {
  try {
    const faq = await Faq.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    void logActivity({
      user: req.user._id,
      userType: req.user.userType,
      action: "update",
      detail: `Updated FAQ ${faq.question}`,
      module: "faq",
      targetId: faq._id,
      metadata: {
        question: faq.question,
      },
    });
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "updated_faq_successfully",
      data: faq,
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

// Delete FAQs
const deleteFaqs = async (req, res) => {
  try {
    const faq = await Faq.findByIdAndDelete(req.params.id);
    if (faq) {
      void logActivity({
        user: req.user._id,
        userType: req.user.userType,
        action: "delete",
        detail: `Deleted FAQ ${faq.question}`,
        module: "faq",
        targetId: faq._id,
        metadata: {
          question: faq.question,
        },
      });
    }
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "faq_deleted_successfully",
      data: faq,
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

// Create FAQs
const createFaqs = async (req, res) => {
  try {
    const { question, answer } = req.body;
    const faq = await Faq.create({
      question,
      answer,
    });
    void logActivity({
      user: req.user._id,
      userType: req.user.userType,
      action: "create",
      detail: `Created FAQ ${faq.question}`,
      module: "faq",
      targetId: faq._id,
      metadata: {
        question: faq.question,
      },
    });
    return sendResponse({
      res,
      statusCode: 201,
      translationKey: "faq-created",
      data: faq,
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

module.exports = {
  getTermsAndConditions,
  getAboutUs,
  getPrivacyPolicy,
  updateTermsAndConditions,
  updateAboutUs,
  updatePrivacyPolicy,
  getFaqs,
  createFaqs,
  updateFaqs,
  deleteFaqs,
};
