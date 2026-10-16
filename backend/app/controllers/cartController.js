const Recipe = require("@models/Recipe");
const { getActiveCart } = require("@utils/cartUtil");
const {
  generateMeta,
  parsePaginationParams,
  sendResponse,
  validateParams,
} = require("@utils/responseUtil");

const getCartRecipes = async (req, res) => {
  try {
    const { page, limit, skip } = parsePaginationParams(req);

    const cart = await getActiveCart(req.user._id);

    if (!cart) {
      return sendResponse({
        res,

        statusCode: 200,

        translationKey: "data_fetched_successfully",

        data: [],

        meta: generateMeta(page, limit, 0),
      });
    }

    const recipes = cart.recipes.map((item) => ({
      _id: item.recipe._id,

      title: item.recipe.title,

      image: item.recipe.image,

      prepTime: item.recipe.prepTime,

      mealType: item.recipe.mealType,
    }));

    const totalRecords = recipes.length;

    const paginated = recipes.slice(skip, skip + limit);

    return sendResponse({
      res,

      statusCode: 200,

      translationKey: "data_fetched_successfully",

      data: paginated,

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

const getCartRecipeDetail = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        pathParams: ["recipeId"],
        objectIdFields: ["recipeId"],
      })
    ) {
      return;
    }

    const cart = await getActiveCart(req.user._id);

    if (!cart) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "cart_not_found",
      });
    }

    const recipe = cart.recipes.find(
      (item) => String(item.recipe._id) === String(req.params.recipeId),
    );

    if (!recipe) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "recipe_not_found",
      });
    }

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: recipe,
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

const addIngredient = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        pathParams: ["recipeId"],

        rawData: ["name", "quantity"],
      })
    )
      return;

    const cart = await getActiveCart(req.user._id);

    if (!cart) {
      return sendResponse({
        res,

        statusCode: 404,

        translationKey: "cart_not_found",
      });
    }

    const recipe = cart.recipes.find(
      (item) => String(item.recipe._id) === String(req.params.recipeId),
    );

    if (!recipe) {
      return sendResponse({
        res,

        statusCode: 404,

        translationKey: "recipe_not_found",
      });
    }

    recipe.ingredients.push({
      ingredientId: new mongoose.Types.ObjectId(),
      name: req.body.name,
      quantity: req.body.quantity,
      icon: "",
      category: "",
      checked: false,
      source: "custom",
    });

    await cart.save();

    return sendResponse({
      res,

      statusCode: 200,

      translationKey: "ingredient_added_success",

      data: recipe,
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

const toggleIngredient = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        pathParams: ["recipeId", "ingredientId"],
        objectIdFields: ["recipeId", "ingredientId"],
      })
    ) {
      return;
    }

    const cart = await getActiveCart(req.user._id);

    if (!cart) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "cart_not_found",
      });
    }

    const recipe = cart.recipes.find(
      (item) => String(item.recipe._id) === String(req.params.recipeId),
    );

    if (!recipe) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "recipe_not_found",
      });
    }

    const ingredient = recipe.ingredients.id(req.params.ingredientId);

    if (!ingredient) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "ingredient_not_found",
      });
    }

    ingredient.checked = !ingredient.checked;

    await cart.save();

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "ingredient_updated_success",
      data: ingredient,
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

const removeIngredient = async (req, res) => {
  try {
    const cart = await getActiveCart(req.user._id);

    if (!cart) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "cart_not_found",
      });
    }

    const recipe = cart.recipes.find(
      (item) => String(item.recipe._id) === String(req.params.recipeId),
    );

    if (!recipe) {
      return sendResponse({
        res,

        statusCode: 404,

        translationKey: "recipe_not_found",
      });
    }

    const ingredient = recipe.ingredients.id(req.params.ingredientId);

    if (!ingredient) {
      return sendResponse({
        res,

        statusCode: 404,

        translationKey: "ingredient_not_found",
      });
    }

    ingredient.deleteOne();

    await cart.save();

    return sendResponse({
      res,

      statusCode: 200,

      translationKey: "ingredient_removed_success",
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

const markAllDone = async (req, res) => {
  try {
    const cart = await getActiveCart(req.user._id);

    if (!cart) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "cart_not_found",
      });
    }

    const recipe = cart.recipes.find(
      (item) => String(item.recipe._id) === String(req.params.recipeId),
    );

    if (!recipe) {
      return sendResponse({
        res,

        statusCode: 404,

        translationKey: "recipe_not_found",
      });
    }

    recipe.ingredients.forEach((ingredient) => {
      ingredient.checked = true;
    });

    await cart.save();

    return sendResponse({
      res,

      statusCode: 200,

      translationKey: "ingredients_marked_success",
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

const deleteRecipeCart = async (req, res) => {
  try {
    const cart = await getActiveCart(req.user._id);

    if (!cart) {
      return sendResponse({
        res,

        statusCode: 404,

        translationKey: "cart_not_found",
      });
    }

    cart.recipes = cart.recipes.filter(
      (r) => String(r.recipe._id) !== String(req.params.recipeId),
    );

    await cart.save();

    return sendResponse({
      res,

      statusCode: 200,

      translationKey: "recipe_removed_success",
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
  getCartRecipes,

  getCartRecipeDetail,

  addIngredient,

  toggleIngredient,

  removeIngredient,

  markAllDone,

  deleteRecipeCart,
};
