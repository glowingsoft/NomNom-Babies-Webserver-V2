const Baby = require("@models/Baby");
const GroceryList = require("@models/GroceryList");
const Recipe = require("@models/Recipe");
const { User } = require("@models/UserModel");
const { babyPopulate } = require("@utils/babyUtil");
const { logActivity } = require("@utils/activityUtil");

const {
  sendResponse,
  parsePaginationParams,
  generateMeta,
  validateParams,
} = require("@utils/responseUtil");

// Add recipe ingredients to grocery list
const addRecipeToGroceryList = async (req, res) => {
  try {
    const { recipeId, ingredientIds } = req.body;

    const user = await User.findById(req.user._id);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 200,
        translationKey: "data_fetched_successfully",
        data: {
          hasBaby: false,
          recommendedToday: [],
        },
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

    let groceryList = await GroceryList.findOne({
      user: req.user._id,
      baby: user.activeBaby,
    });

    if (!groceryList) {
      groceryList = await GroceryList.create({
        user: req.user._id,
        baby: user.activeBaby,
        recipes: [],
      });
    }

    const alreadyExists = groceryList.recipes.find(
      (r) => String(r.recipe) === String(recipeId),
    );

    if (alreadyExists) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "recipe_already_added",
      });
    }

    const selectedIngredients = recipe.ingredients.filter((ingredient) =>
      ingredientIds.includes(String(ingredient.ingredientId)),
    );

    if (!selectedIngredients.length) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "ingredient_not_found",
      });
    }

    groceryList.recipes.push({
      recipe: recipeId,

      ingredients: selectedIngredients.map((ingredient) => ({
        ingredientId: ingredient.ingredientId,
        name: ingredient.name,
        quantity: ingredient.quantity,
        icon: ingredient.icon,
        category: ingredient.category,
        checked: false,
        source: "recipe",
      })),
    });

    await groceryList.save();

    void logActivity({
      user: req.user._id,
      userType: req.user.userType,
      action: "add",
      detail: `Added recipe ${recipe.title} to grocery list`,
      module: "grocery_list",
      baby: user.activeBaby,
      targetId: groceryList._id,
      metadata: {
        recipeId: recipe._id,
        recipeTitle: recipe.title,
        ingredientCount: selectedIngredients.length,
      },
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "grocery_list_updated_successfully",
      data: groceryList,
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

// Get grocery list
const getGroceryList = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 200,
        translationKey: "data_fetched_successfully",
        data: {
          recipesIncluded: [],

          groceryChecklist: [],

          ingredientCategories: [],
        },
      });
    }

    const { page, limit, skip } = parsePaginationParams(req);

    const groceryList = await GroceryList.findOne({
      user: req.user._id,
      baby: user.activeBaby,
    }).populate("recipes.recipe", "_id title image");

    if (!groceryList) {
      return sendResponse({
        res,
        statusCode: 200,
        translationKey: "data_fetched_successfully",
        data: {
          recipesIncluded: [],
          groceryChecklist: [],
          ingredientCategories: [],
        },
        meta: generateMeta(page, limit, 0),
      });
    }

    const recipesIncluded = groceryList.recipes.map((r) => ({
      recipeId: r.recipe._id,
      title: r.recipe.title,
    }));

    const groceryChecklist = [];
    const categoriesMap = {};

    groceryList.recipes.forEach((recipe) => {
      recipe.ingredients.forEach((ingredient) => {
        groceryChecklist.push({
          _id: ingredient._id,
          name: ingredient.name,
          icon: ingredient.icon,
          quantity: ingredient.quantity,
          checked: ingredient.checked,
          category: ingredient.category,
        });

        if (ingredient.category) {
          if (!categoriesMap[ingredient.category]) {
            categoriesMap[ingredient.category] = [];
          }

          categoriesMap[ingredient.category] = [
            ...(categoriesMap[ingredient.category] || []),
            ingredient.name,
          ];
        }
      });
    });

    const totalRecords = groceryChecklist.length;

    const paginatedChecklist = groceryChecklist.slice(skip, skip + limit);

    const ingredientCategories = Object.keys(categoriesMap).map((category) => ({
      category,

      items: [...new Set(categoriesMap[category])],
    }));

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: {
        recipesIncluded,
        groceryChecklist: paginatedChecklist,
        ingredientCategories,
      },
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

const updateIngredientStatus = async (req, res) => {
  try {
    const { ingredientId } = req.params;
    const { checked } = req.body;

    const userId = req.user._id;

    const user = await User.findById(userId);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    const groceryList = await GroceryList.findOne({
      user: req.user._id,
      baby: user.activeBaby,
    });

    if (!groceryList) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "grocery_list_not_found",
      });
    }

    let targetIngredient = null;

    groceryList.recipes.forEach((recipe) => {
      const ingredient = recipe.ingredients.id(ingredientId);

      if (ingredient) {
        targetIngredient = ingredient;
      }
    });

    if (!targetIngredient) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "ingredient_not_found",
      });
    }

    targetIngredient.checked = checked;

    await groceryList.save();

    void logActivity({
      user: req.user._id,
      userType: req.user.userType,
      action: "update",
      detail: `${checked ? "Checked" : "Unchecked"} grocery ingredient ${targetIngredient.name}`,
      module: "grocery_list",
      baby: user.activeBaby,
      targetId: groceryList._id,
      metadata: {
        ingredientId,
        ingredientName: targetIngredient.name,
        checked,
      },
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "ingredient_updated_success",
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

// Update item checked status
const updateGroceryItems = async (req, res) => {
  try {
    const { selectedItems, checked } = req.body;

    if (!Array.isArray(selectedItems) || selectedItems.length === 0) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "selected_items_required",
      });
    }

    const user = await User.findById(req.user._id);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    const groceryList = await GroceryList.findOne({
      user: req.user._id,
      baby: user.activeBaby,
    });

    if (!groceryList) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "grocery_list_not_found",
      });
    }

    const selectedSet = new Set(selectedItems);

    const updatedIngredients = [];

    outerLoop: for (const recipe of groceryList.recipes) {
      for (const ingredient of recipe.ingredients) {
        const id = String(ingredient._id);

        if (!selectedSet.has(id)) continue;

        ingredient.checked = checked;

        updatedIngredients.push({
          _id: ingredient._id,
          name: ingredient.name,
          checked: ingredient.checked,
        });

        selectedSet.delete(id);

        if (selectedSet.size === 0) {
          break outerLoop;
        }
      }
    }

    if (!updatedIngredients.length) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "ingredient_not_found",
      });
    }

    await groceryList.save();

    void logActivity({
      user: req.user._id,
      userType: req.user.userType,
      action: "update",
      detail: `${checked ? "Checked" : "Unchecked"} ${updatedIngredients.length} grocery items`,
      module: "grocery_list",
      baby: user.activeBaby,
      targetId: groceryList._id,
      metadata: {
        ingredientIds: updatedIngredients.map((i) => i._id),
        checked,
      },
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "grocery_item_updated_success",
      data: {
        updatedItems: updatedIngredients,
      },
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

const removeRecipeFromGroceryList = async (req, res) => {
  try {
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

    const groceryList = await GroceryList.findOne({
      user: req.user._id,
      baby: user.activeBaby,
    });

    if (!groceryList) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "grocery_list_not_found",
      });
    }

    const removedRecipe = groceryList.recipes.find(
      (recipe) => String(recipe.recipe) === String(recipeId),
    );

    groceryList.recipes = groceryList.recipes.filter(
      (recipe) => String(recipe.recipe) !== String(recipeId),
    );

    await groceryList.save();

    void logActivity({
      user: req.user._id,
      userType: req.user.userType,
      action: "delete",
      detail: "Removed recipe from grocery list",
      module: "grocery_list",
      baby: user.activeBaby,
      targetId: groceryList._id,
      metadata: {
        recipeId,
        ingredientCount: removedRecipe?.ingredients?.length || 0,
      },
    });

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

// Remove item
const removeGroceryItem = async (req, res) => {
  try {
    const { itemId } = req.params;

    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    const groceryList = await GroceryList.findOne({
      user: userId,
      baby: user.activeBaby,
    });

    if (!groceryList) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "grocery_list_not_found",
      });
    }

    let ingredientFound = false;

    groceryList.recipes.forEach((recipe) => {
      const ingredient = recipe.ingredients.id(itemId);

      if (ingredient) {
        ingredient.deleteOne();
        ingredientFound = true;
      }
    });

    if (!ingredientFound) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "ingredient_not_found",
      });
    }

    let removedIngredient = null;

    groceryList.recipes.forEach((recipe) => {
      const ingredient = recipe.ingredients.id(itemId);

      if (ingredient) {
        removedIngredient = ingredient.toObject();
        ingredient.deleteOne();
        ingredientFound = true;
      }
    });

    await groceryList.save();

    void logActivity({
      user: req.user._id,
      userType: req.user.userType,
      action: "delete",
      detail: `Removed grocery item ${removedIngredient?.name}`,
      module: "grocery_list",
      baby: user.activeBaby,
      targetId: groceryList._id,
      metadata: {
        ingredientId: itemId,
        ingredientName: removedIngredient?.name,
      },
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "grocery_item_removed_success",
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

// Clear list
const clearGroceryList = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    const groceryList = await GroceryList.findOne({
      user: userId,
      baby: user.activeBaby,
    });

    const recipeCount = groceryList?.recipes.length || 0;

    await GroceryList.findOneAndUpdate(
      {
        user: userId,
        baby: user.activeBaby,
      },
      {
        recipes: [],
      },
    );

    void logActivity({
      user: req.user._id,
      userType: req.user.userType,
      action: "delete",
      detail: "Cleared grocery list",
      module: "grocery_list",
      baby: user.activeBaby,
      targetId: groceryList?._id,
      metadata: {
        recipesRemoved: recipeCount,
      },
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "grocery_list_cleared_success",
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

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN
// ─────────────────────────────────────────────────────────────────────────────

// Get all grocery lists (one per user who has created one)
const adminGetGroceryLists = async (req, res) => {
  try {
    const { page, limit, skip } = parsePaginationParams(req);
    const { search = "" } = req.query;

    const query = {};

    if (search.trim()) {
      const matchingUserIds = await User.find({
        $or: [
          { name: { $regex: search.trim(), $options: "i" } },
          { email: { $regex: search.trim(), $options: "i" } },
        ],
      }).distinct("_id");

      query.user = { $in: matchingUserIds };
    }

    const [groceryLists, totalRecords] = await Promise.all([
      GroceryList.find(query)
        .populate("user", "_id name email")
        .populate("baby", "_id name")
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),

      GroceryList.countDocuments(query),
    ]);

    const data = groceryLists.map((list) => ({
      _id: list._id,
      user: list.user,
      baby: list.baby,
      recipesCount: list.recipes.length,
      itemsCount: list.recipes.reduce(
        (sum, r) => sum + (r.ingredients?.length || 0),
        0,
      ),
      createdAt: list.createdAt,
      updatedAt: list.updatedAt,
    }));

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data,
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

// Get a single grocery list by its id
const adminGetGroceryListById = async (req, res) => {
  try {
    if (
      !validateParams(req, res, {
        pathParams: ["id"],
        objectIdFields: ["id"],
      })
    ) {
      return;
    }

    const groceryList = await GroceryList.findById(req.params.id)
      .populate("user", "_id name email")
      .populate("baby", "_id name")
      .populate("recipes.recipe", "_id title image");

    if (!groceryList) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "grocery_list_not_found",
      });
    }

    const recipesIncluded = groceryList.recipes.map((r) => ({
      recipeId: r.recipe?._id,
      title: r.recipe?.title,
      image: r.recipe?.image,
    }));

    const groceryChecklist = [];
    const categoriesMap = {};

    groceryList.recipes.forEach((recipe) => {
      recipe.ingredients.forEach((ingredient) => {
        groceryChecklist.push({
          _id: ingredient._id,
          name: ingredient.name,
          icon: ingredient.icon,
          quantity: ingredient.quantity,
          category: ingredient.category,
        });

        if (ingredient.category) {
          categoriesMap[ingredient.category] = [
            ...(categoriesMap[ingredient.category] || []),
            ingredient.name,
          ];
        }
      });
    });

    const ingredientCategories = Object.keys(categoriesMap).map(
      (category) => ({
        category,
        items: [...new Set(categoriesMap[category])],
      }),
    );

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: {
        _id: groceryList._id,
        user: groceryList.user,
        baby: groceryList.baby,
        recipesIncluded,
        groceryChecklist,
        ingredientCategories,
      },
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
  addRecipeToGroceryList,
  getGroceryList,
  updateIngredientStatus,
  updateGroceryItems,
  removeRecipeFromGroceryList,
  removeGroceryItem,
  clearGroceryList,
  adminGetGroceryLists,
  adminGetGroceryListById,
};
