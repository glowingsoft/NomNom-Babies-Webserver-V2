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

// Add recipe to favorites
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

// Remove favorite
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

// Get user favorites
const getFavorites = async (req, res) => {
  try {
    const userId = req.user._id;

    const { page, limit, skip } = parsePaginationParams(req);

    const query = {
      user: userId,
    };

    const [favorites, totalRecords] = await Promise.all([
      FavoriteRecipe.find(query)
        .populate({
          path: "recipe",
          select: "_id title image prepTime mealType",
        })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),

      FavoriteRecipe.countDocuments(query),
    ]);

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: favorites.map((item) => ({
        _id: item.recipe?._id,

        title: item.recipe?.title,

        image: item.recipe?.image,

        prepTime: item.recipe?.prepTime,

        mealType: item.recipe?.mealType,
      })),
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
