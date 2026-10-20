const FavoriteRecipe = require("@models/FavoriteRecipe");
const Recipe = require("@models/Recipe");
const { User } = require("@models/UserModel");
const {
  sendResponse,
  validateParams,
  parsePaginationParams,
  generateMeta,
} = require("@utils/responseUtil");
const { logActivity } = require("@utils/activityUtil");
const { lookupOne } = require("@utils/aggregationUtil");

const addFavorite = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        pathParams: ["recipeId"],
        objectIdFields: ["recipeId"],
      })
    ) {
      return;
    }

    const { recipeId } = req.params;

    const userId = req.user._id;

    const user = await User.findById(userId);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    const recipe = await Recipe.findById(recipeId);

    if (!recipe) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "recipe_not_found",
      });
    }

    const existingFavorite = await FavoriteRecipe.findOne({
      user: userId,

      baby: user.activeBaby,

      recipe: recipeId,
    });

    if (existingFavorite) {
      return sendResponse({
        res,
        statusCode: 409,
        translationKey: "recipe_already_favorited",
      });
    }

    const favorite = await FavoriteRecipe.create({
      user: userId,

      baby: user.activeBaby,

      recipe: recipeId,
    });

    void logActivity({
      user: req.user._id,
      userType: req.user.userType ?? req.user.accountState?.userType,
      action: "Recipe Favorited",
      detail: `Added recipe ${recipe.title} to favorites`,
      module: "favorite_recipe",
      baby: user.activeBaby,
      targetId: recipe._id,
      metadata: {
        recipeId: recipe._id,
        recipeTitle: recipe.title,
      },
    });

    return sendResponse({
      res,

      statusCode: 201,

      translationKey: "recipe_favorited_success",

      data: favorite,
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

const removeFavorite = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        pathParams: ["recipeId"],
        objectIdFields: ["recipeId"],
      })
    ) {
      return;
    }

    const { recipeId } = req.params;

    const userId = req.user._id;

    const user = await User.findById(userId);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    const recipe = await Recipe.findById(recipeId).select("title");

    const favorite = await FavoriteRecipe.findOneAndDelete({
      user: userId,

      baby: user.activeBaby,

      recipe: recipeId,
    });

    if (!favorite) {
      return sendResponse({
        res,

        statusCode: 404,

        translationKey: "favorite_not_found",
      });
    }

    void logActivity({
      user: req.user._id,
      userType: req.user.userType ?? req.user.accountState?.userType,
      action: "Recipe Unfavorited",
      detail: `Removed recipe ${recipe?.title || "Unknown"} from favorites`,
      module: "favorite_recipe",
      baby: user.activeBaby,
      targetId: recipeId,
      metadata: {
        recipeId,
        recipeTitle: recipe?.title || null,
      },
    });

    return sendResponse({
      res,

      statusCode: 200,

      translationKey: "favorite_removed_success",
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

const getFavorites = async (req, res) => {
  try {
    const userId = req.user._id;

    const { page, limit, skip } = parsePaginationParams(req);

    const query = {
      user: userId,
    };

    const castedQuery = FavoriteRecipe.find(query).cast(FavoriteRecipe);

    const [favorites, totalRecords] = await Promise.all([
      FavoriteRecipe.aggregate([
        { $match: castedQuery },
        { $sort: { createdAt: -1 } },
        { $skip: skip },
        { $limit: limit },
        ...lookupOne({
          from: Recipe.collection.name,
          field: "recipe",
          fields: ["_id", "title", "image", "prepTime", "mealType"],
        }),
        {
          $replaceWith: {
            _id: "$recipe._id",
            title: "$recipe.title",
            image: {
              $cond: ["$recipe", { $ifNull: ["$recipe.image", ""] }, "$$REMOVE"],
            },
            prepTime: "$recipe.prepTime",
            mealType: "$recipe.mealType",
          },
        },
      ]),

      FavoriteRecipe.countDocuments(query),
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: favorites,
      meta: generateMeta(page, limit, totalRecords),
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
  addFavorite,
  removeFavorite,
  getFavorites,
};
