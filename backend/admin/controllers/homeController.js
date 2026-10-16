const { User } = require("@models/UserModel"); // Assuming this is the User model path
const Review = require("@models/Review"); // Assuming this is the Review model path

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
