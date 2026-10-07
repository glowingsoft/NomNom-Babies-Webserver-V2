const Cart = require("@models/Cart");
const GroceryList = require("@models/GroceryList");
const { User } = require("@models/UserModel");

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
  }).populate("recipes.recipe", "_id title image prepTime mealType");

  if (groceryList) {
    groceryList.recipes.forEach((groceryRecipe) => {
      const alreadyExists = cart.recipes.some(
        (cartRecipe) =>
          String(cartRecipe.recipe) === String(groceryRecipe.recipe._id),
      );

      if (!alreadyExists) {
        cart.recipes.push({
          recipe: groceryRecipe.recipe._id,

          ingredients: groceryRecipe.ingredients.map((ingredient) => ({
            name: ingredient.name,
            quantity: ingredient.quantity,
            checked: false,
            source: "recipe",
          })),
        });
      }
    });

    await cart.save();
  }

  return await Cart.findById(cart._id).populate(
    "recipes.recipe",
    "_id title prepTime mealType",
  );
};

module.exports = {
  getActiveCart,
};
