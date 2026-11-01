const { User } = require("@models/UserModel");
const Review = require("@models/Review");

const {
  sendResponse,
} = require("@utils/responseUtil");
const getHome = async (req, res) => {
  try {

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: [],
    });
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "internal_server",
      error: error,
    });
  }
};

module.exports = {
  getHome,
};
