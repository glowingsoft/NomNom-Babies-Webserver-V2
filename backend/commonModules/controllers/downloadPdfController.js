const FeedingSchedule = require("@models/FeedingSchedule");
const Recipe = require("@models/Recipe");
const GroceryList = require("@models/GroceryList");
const Baby = require("@models/Baby");
const { User } = require("@models/UserModel");

const {
  generateFeedingTimeTablePdf,
} = require("@utils/downloadPdf/feedingTimeTablePdf");

const { generateRecipePdf } = require("@utils/downloadPdf/recipeDetailPdf");

const { generateGroceryPdf } = require("@utils/downloadPdf/groceryListPdf");

const { sendResponse, parsePaginationParams, generateMeta } = require("@utils/responseUtil");
const { babyPopulate } = require("@utils/babyUtil");
const FeedingLog = require("@models/FeedingLog");
const { savePdf } = require("@utils/downloadPdf/pdfStorage");
const { logActivity } = require("@utils/activityUtil");
const Activity = require("@models/Activity");

const downloadFeedingTimeTablePdf = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }
    const today = new Date().toISOString().split("T")[0];

    const baby = await Baby.findById(user.activeBaby).populate(babyPopulate);

    const schedules = await FeedingSchedule.find({
      baby: baby._id,
      user: req.user._id,
      date: today,
    }).sort({ time: 1 });

    const logs = await FeedingLog.find({
      baby: baby._id,
      user: req.user._id,
      date: today,
    });

    const completedIds = new Set(logs.map((log) => String(log.slotId)));

    const recommendedToday = schedules.map((slot) => ({
      _id: slot._id,
      type: slot.type,
      title: slot.title,
      description: slot.description,
      time: slot.time,
      completed: completedIds.has(String(slot._id)),
    }));

    const completionRate =
      recommendedToday.length === 0
        ? 0
        : Math.round(
            (recommendedToday.filter((m) => m.completed).length /
              recommendedToday.length) *
              100,
          );

    const babyInfo = {
      _id: baby._id,
      name: baby.name,
      profileIcon: baby.profileIcon,
      stage: {
        _id: baby.babyStage._id,
        title: baby.babyStage.title,
      },
      countries: baby.selectedCountries,
    };

    const feedingNotes = [
      "Introduce one new food at a time to track allergies",
      "Use soft puree texture",
      "Observe reactions carefully",
    ];

    const pdf = await generateFeedingTimeTablePdf({
      babyInfo,
      completionRate,
      recommendedToday,
      feedingNotes,
    });

    const relativePath = await savePdf(pdf, `feeding-${baby._id}.pdf`);

    const pdfUrl = `${req.protocol}://${req.get("host")}${relativePath}`;

    void logActivity({
      user: req.user._id,
      userType: req.user.userType,
      action: "download",
      detail: "Downloaded feeding timetable PDF",
      module: "feeding_timetable",
      baby: baby._id,
      targetId: baby._id,
      metadata: {
        date: today,
        completionRate,
        totalMeals: recommendedToday.length,
      },
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: {
        pdfUrl,
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

const downloadRecipePdf = async (req, res) => {
  try {
    const recipe = await Recipe.findById(req.params.recipeId)
      .populate("country", "_id name")
      .populate("babyStage", "_id title")
      .populate("nutritionTags", "_id name");

    if (!recipe) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "recipe_not_found",
      });
    }

    const recipeResponse = {
      recipeId: recipe._id,

      title: recipe.title,

      image: recipe.image,

      prepTime: `${recipe.prepTime}`,

      mealType: recipe.mealType,

      stage: recipe.babyStage
        ? {
            _id: recipe.babyStage._id,
            title: recipe.babyStage.title,
          }
        : null,

      country: recipe.country
        ? {
            _id: recipe.country._id,
            name: recipe.country.name,
          }
        : null,

      nutritionTags: (recipe.nutritionTags || []).map((tag) =>
        typeof tag === "string" ? tag : tag.name,
      ),

      ingredients: recipe.ingredients.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        icon: item.icon,
      })),

      instructions: recipe.method.map((step) => ({
        step: step.step,

        description: step.instruction,
      })),

      notes: recipe.notes,

      acceptanceLabel: recipe.acceptanceLabel,
    };

    const pdf = await generateRecipePdf(recipeResponse);

    const filename = `recipe-${recipe._id}.pdf`;

    const relativePath = await savePdf(pdf, filename);

    const pdfUrl = `${req.protocol}://${req.get("host")}${relativePath}`;

    void logActivity({
      user: req.user._id,
      userType: req.user.userType,
      action: "download",
      detail: `Downloaded recipe PDF ${recipe.title}`,
      module: "recipe",
      targetId: recipe._id,
      metadata: {
        recipeId: recipe._id,
        recipeTitle: recipe.title,
        mealType: recipe.mealType,
      },
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: {
        pdfUrl,
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

const downloadGroceryPdf = async (req, res) => {
  try {
    const grocery = await GroceryList.findOne({
      user: req.user._id,
    }).populate("recipes.recipe", "_id title image");

    if (!grocery) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "grocery_list_not_found",
      });
    }

    ////////////////////////////////////////////

    const recipesIncluded = grocery.recipes.map((recipe) => ({
      recipeId: recipe.recipe._id,

      title: recipe.recipe.title,

      image: recipe.recipe.image || "",
    }));

    ////////////////////////////////////////////

    const groceryChecklist = [];

    const categoriesMap = {};

    grocery.recipes.forEach((recipe) => {
      recipe.ingredients.forEach((ingredient) => {
        groceryChecklist.push({
          _id: ingredient._id,

          name: ingredient.name,

          icon: ingredient.icon || "",

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

    ////////////////////////////////////////////

    const ingredientCategories = Object.keys(categoriesMap).map((category) => ({
      category,

      items: [...new Set(categoriesMap[category])],
    }));

    ////////////////////////////////////////////

    const groceryResponse = {
      recipesIncluded,

      groceryChecklist,

      ingredientCategories,
    };

    const pdf = await generateGroceryPdf(groceryResponse);

    const relativePath = await savePdf(pdf, `grocery-${req.user._id}.pdf`);

    const pdfUrl = `${req.protocol}://${req.get("host")}${relativePath}`;

    void logActivity({
      user: req.user._id,
      userType: req.user.userType,
      action: "download",
      detail: "Downloaded grocery list PDF",
      module: "grocery_list",
      baby: grocery.baby || null,
      targetId: grocery._id,
      metadata: {
        recipes: grocery.recipes.length,
        ingredients: groceryChecklist.length,
      },
    });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: {
        pdfUrl,
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

const getDownloadedPdfs = async (req, res) => {
  try {
    const { page, limit } = parsePaginationParams(req);
    const { keyword, type } = req.query;

    const validModules = ["recipe", "feeding_timetable", "grocery_list"];
    const baseMatch = { action: "download", module: { $in: validModules } };

    const pipeline = [
      { $match: baseMatch },
      {
        $lookup: {
          from: "users",
          localField: "user",
          foreignField: "_id",
          as: "userDoc",
        },
      },
      { $unwind: { path: "$userDoc", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "recipes",
          localField: "targetId",
          foreignField: "_id",
          as: "recipeDoc",
        },
      },
      {
        $lookup: {
          from: "babies",
          localField: "targetId",
          foreignField: "_id",
          as: "babyDoc",
        },
      },
      {
        $lookup: {
          from: "grocerylists",
          localField: "targetId",
          foreignField: "_id",
          as: "groceryDoc",
        },
      },
      {
        $lookup: {
          from: "babies",
          localField: "groceryDoc.baby",
          foreignField: "_id",
          as: "groceryBabyDoc",
        },
      },
      {
        $addFields: {
          countryIds: {
            $switch: {
              branches: [
                {
                  case: { $eq: ["$module", "recipe"] },
                  then: {
                    $filter: {
                      input: [{ $arrayElemAt: ["$recipeDoc.country", 0] }],
                      as: "c",
                      cond: { $ne: ["$$c", null] },
                    },
                  },
                },
                {
                  case: { $eq: ["$module", "feeding_timetable"] },
                  then: {
                    $ifNull: [
                      { $arrayElemAt: ["$babyDoc.selectedCountries", 0] },
                      [],
                    ],
                  },
                },
                {
                  case: { $eq: ["$module", "grocery_list"] },
                  then: {
                    $ifNull: [
                      {
                        $arrayElemAt: ["$groceryBabyDoc.selectedCountries", 0],
                      },
                      [],
                    ],
                  },
                },
              ],
              default: [],
            },
          },
        },
      },
      {
        $lookup: {
          from: "countries",
          localField: "countryIds",
          foreignField: "_id",
          as: "countryDocs",
        },
      },

      ...(keyword && keyword.trim() !== ""
        ? [
            {
              $match: {
                $or: [
                  { detail: { $regex: keyword, $options: "i" } },
                  { "userDoc.name": { $regex: keyword, $options: "i" } },
                  { "userDoc.email": { $regex: keyword, $options: "i" } },
                ],
              },
            },
          ]
        : []),

      { $sort: { createdAt: -1 } },

      {
        $facet: {
          counts: [{ $group: { _id: "$module", count: { $sum: 1 } } }],

          data: [
            ...(type && validModules.includes(type)
              ? [{ $match: { module: type } }]
              : []),
            { $skip: (page - 1) * limit },
            { $limit: limit },
            {
              $project: {
                _id: 0,
                id: "$_id",
                type: "$module",
                detail: 1,
                userName: { $ifNull: ["$userDoc.name", "—"] },
                userEmail: { $ifNull: ["$userDoc.email", "—"] },
                downloadedAt: "$createdAt",
                pdfPath: "$metadata.pdfPath",
                countries: {
                  $map: {
                    input: "$countryDocs",
                    as: "c",
                    in: { _id: "$$c._id", name: "$$c.name", flag: "$$c.flag" },
                  },
                },
              },
            },
          ],

          totalForType: [
            ...(type && validModules.includes(type)
              ? [{ $match: { module: type } }]
              : []),
            { $count: "total" },
          ],
        },
      },
    ];

    const [result] = await Activity.aggregate(pipeline);

    const countsByModule = Object.fromEntries(
      (result?.counts || []).map((c) => [c._id, c.count]),
    );
    const allCount = Object.values(countsByModule).reduce(
      (sum, n) => sum + n,
      0,
    );

    const typeLabels = {
      recipe: "Recipe",
      feeding_timetable: "Feeding timetable",
      grocery_list: "Grocery list",
    };

    const data = (result?.data || []).map((row) => ({
      ...row,
      typeLabel: typeLabels[row.type] || row.type,
      pdfUrl: row.pdfPath
        ? `${req.protocol}://${req.get("host")}${row.pdfPath}`
        : null,
    }));

    const totalRecords = result?.totalForType?.[0]?.total || 0;
    const meta = generateMeta(page, limit, totalRecords);
    meta.counts = {
      all: allCount,
      recipe: countsByModule.recipe || 0,
      feeding_timetable: countsByModule.feeding_timetable || 0,
      grocery_list: countsByModule.grocery_list || 0,
    };

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data,
      meta,
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
  downloadFeedingTimeTablePdf,
  downloadRecipePdf,
  downloadGroceryPdf,
  getDownloadedPdfs,
};

