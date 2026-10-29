const Cart = require("@models/Cart");
const GroceryList = require("@models/GroceryList");
const { User } = require("@models/UserModel");

/**
 * Cart (per-recipe view) and Grocery List share the "checked" state of recipe ingredients; the grocery list is
 * the source of truth. Items are matched by the recipe's ingredientId, falling back to the name for carts
 * created before the id was copied.
 */
const sameIngredient = (a, b) =>
  (a.ingredientId &&
    b.ingredientId &&
    String(a.ingredientId) === String(b.ingredientId)) ||
  String(a.name || "").trim().toLowerCase() ===
    String(b.name || "").trim().toLowerCase();

const getActiveCart = async (userId) => {
  const user = await User.findById(userId);

  if (!user?.activeBaby) return null;

  let cart = await Cart.findOne({
    user: userId,
    baby: user.activeBaby,
  });

  if (!cart) {
    cart = await Cart.create({
      user: userId,
      baby: user.activeBaby,
      recipes: [],
    });
  }

  const groceryList = await GroceryList.findOne({
    user: userId,
    baby: user.activeBaby,
  }).populate("recipes.recipe", "_id title image prepTime mealType");

  if (groceryList) {
    groceryList.recipes.forEach((groceryRecipe) => {
      if (!groceryRecipe.recipe) return;
      const cartRecipe = cart.recipes.find(
        (r) => String(r.recipe) === String(groceryRecipe.recipe._id),
      );

      if (!cartRecipe) {
        cart.recipes.push({
          recipe: groceryRecipe.recipe._id,
          ingredients: groceryRecipe.ingredients.map((ingredient) => ({
            ingredientId: ingredient.ingredientId,
            name: ingredient.name,
            quantity: ingredient.quantity,
            icon: ingredient.icon,
            category: ingredient.category,
            checked: ingredient.checked,
            source: "recipe",
          })),
        });
        return;
      }

      // Pull the grocery list's checked state into the cart's recipe items.
      cartRecipe.ingredients.forEach((cartIngredient) => {
        if (cartIngredient.source !== "recipe") return;
        const groceryIngredient = groceryRecipe.ingredients.find((g) =>
          sameIngredient(cartIngredient, g),
        );
        if (!groceryIngredient) return;
        cartIngredient.ingredientId = groceryIngredient.ingredientId;
        cartIngredient.checked = groceryIngredient.checked;
      });
    });

    if (cart.isModified()) await cart.save();
  }

  return await Cart.findById(cart._id).populate({
    path: "recipes.recipe",
    select: "_id title image prepTime mealType",
    populate: { path: "mealType", select: "_id name" },
  });
};

/** Writes the cart's checked state of a recipe's ingredients back to the grocery list. */
const mirrorCartToGrocery = async (cart, recipeId) => {
  const cartRecipe = cart.recipes.find(
    (r) => String(r.recipe?._id || r.recipe) === String(recipeId),
  );
  if (!cartRecipe) return;

  const groceryList = await GroceryList.findOne({
    user: cart.user,
    baby: cart.baby,
  });
  const groceryRecipe = groceryList?.recipes.find(
    (r) => String(r.recipe) === String(recipeId),
  );
  if (!groceryRecipe) return;

  groceryRecipe.ingredients.forEach((groceryIngredient) => {
    const cartIngredient = cartRecipe.ingredients.find(
      (c) => c.source === "recipe" && sameIngredient(c, groceryIngredient),
    );
    if (cartIngredient) groceryIngredient.checked = cartIngredient.checked;
  });

  await groceryList.save();
};

module.exports = {
  getActiveCart,
  mirrorCartToGrocery,
};
