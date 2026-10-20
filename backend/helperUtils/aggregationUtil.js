const BabyStage = require("@models/BabyStage");
const Country = require("@models/Country");
const Recipe = require("@models/Recipe");

const keepAbsent = (field, expr) => ({
  $cond: [{ $eq: [{ $type: `$${field}` }, "missing"] }, "$$REMOVE", expr],
});

const pick = (fields, source) =>
  Object.fromEntries(
    fields.map((f) =>
      typeof f === "string"
        ? [f, `${source}.${f}`]
        : [f.name, { $ifNull: [`${source}.${f.name}`, f.default] }],
    ),
  );

const lookupOne = ({ from, field, fields, lean = false }) => {
  const tmp = `__${field}`;
  return [
    {
      $lookup: {
        from,
        localField: field,
        foreignField: "_id",
        as: tmp,
      },
    },
    {
      $addFields: {
        [field]: ((expr) => (lean ? keepAbsent(field, expr) : expr))({
          $let: {
            vars: { d: { $arrayElemAt: [`$${tmp}`, 0] } },
            in: {
              $cond: [
                { $ifNull: ["$$d._id", false] },
                pick(fields, "$$d"),
                null,
              ],
            },
          },
        }),
      },
    },
    { $project: { [tmp]: 0 } },
  ];
};

const lookupMany = ({ from, field, fields, filter, lean = false }) => {
  const tmp = `__${field}`;
  return [
    {
      $lookup: {
        from,
        localField: field,
        foreignField: "_id",
        as: tmp,
      },
    },
    ...(filter
      ? [
          {
            $addFields: {
              [tmp]: { $filter: { input: `$${tmp}`, cond: filter } },
            },
          },
        ]
      : []),
    {
      $addFields: {
        [field]: ((expr) => (lean ? keepAbsent(field, expr) : expr))({
          $filter: {
            input: {
              $map: {
                input: { $ifNull: [`$${field}`, []] },
                as: "id",
                in: {
                  $let: {
                    vars: { idx: { $indexOfArray: [`$${tmp}._id`, "$$id"] } },
                    in: {
                      $cond: [
                        { $gte: ["$$idx", 0] },
                        {
                          $let: {
                            vars: { d: { $arrayElemAt: [`$${tmp}`, "$$idx"] } },
                            in: pick(fields, "$$d"),
                          },
                        },
                        null,
                      ],
                    },
                  },
                },
              },
            },
            cond: { $ne: ["$$this", null] },
          },
        }),
      },
    },
    { $project: { [tmp]: 0 } },
  ];
};

const babyPopulateStages = () => [
  ...lookupOne({
    from: BabyStage.collection.name,
    field: "babyStage",
    fields: ["_id", "title", { name: "features", default: [] }],
  }),
  ...lookupMany({
    from: Country.collection.name,
    field: "selectedCountries",
    fields: ["_id", "name", { name: "signatureFoods", default: [] }],
  }),
];

const babyDocumentDefaults = {
  profileIcon: { $ifNull: ["$profileIcon", ""] },
  isActive: { $ifNull: ["$isActive", true] },
  feedingPlanStarted: { $ifNull: ["$feedingPlanStarted", false] },
  feedingPlanStartedAt: { $ifNull: ["$feedingPlanStartedAt", null] },
};

const leanGroceryRecipeStages = () => [
  { $unset: "recipes.ingredients.checked" },
  {
    $lookup: {
      from: Recipe.collection.name,
      localField: "recipes.recipe",
      foreignField: "_id",
      as: "__recipes",
    },
  },
  {
    $addFields: {
      recipes: {
        $cond: [
          { $isArray: "$recipes" },
          {
            $map: {
              input: "$recipes",
              as: "r",
              in: {
                $mergeObjects: [
                  "$$r",
                  {
                    recipe: {
                      $let: {
                        vars: {
                          idx: {
                            $indexOfArray: ["$__recipes._id", "$$r.recipe"],
                          },
                        },
                        in: {
                          $cond: [
                            { $gte: ["$$idx", 0] },
                            {
                              $let: {
                                vars: {
                                  d: {
                                    $arrayElemAt: ["$__recipes", "$$idx"],
                                  },
                                },
                                in: {
                                  _id: "$$d._id",
                                  title: "$$d.title",
                                  image: "$$d.image",
                                  icon: "$$d.icon",
                                },
                              },
                            },
                            null,
                          ],
                        },
                      },
                    },
                  },
                ],
              },
            },
          },
          "$$REMOVE",
        ],
      },
    },
  },
  { $project: { __recipes: 0 } },
];

const recipeDocumentDefaults = {
  image: { $ifNull: ["$image", ""] },
  icon: { $ifNull: ["$icon", ""] },
  views: { $ifNull: ["$views", 0] },
  feedingInsight: { $ifNull: ["$feedingInsight", ""] },
  allergyReminder: { $ifNull: ["$allergyReminder", ""] },
  notes: { $ifNull: ["$notes", ""] },
  acceptanceLabel: { $ifNull: ["$acceptanceLabel", ""] },
  status: { $ifNull: ["$status", "published"] },
  isActive: { $ifNull: ["$isActive", true] },
  method: { $ifNull: ["$method", []] },
  ingredients: {
    $map: {
      input: { $ifNull: ["$ingredients", []] },
      as: "ing",
      in: {
        $mergeObjects: [
          "$$ing",
          {
            quantity: { $ifNull: ["$$ing.quantity", ""] },
            icon: { $ifNull: ["$$ing.icon", ""] },
            category: { $ifNull: ["$$ing.category", ""] },
          },
        ],
      },
    },
  },
};

const groceryRecipeStages = () => [
  {
    $lookup: {
      from: Recipe.collection.name,
      localField: "recipes.recipe",
      foreignField: "_id",
      as: "__recipes",
    },
  },
  {
    $addFields: {
      recipes: {
        $map: {
          input: { $ifNull: ["$recipes", []] },
          as: "r",
          in: {
            $mergeObjects: [
              "$$r",
              {
                recipe: {
                  $let: {
                    vars: {
                      idx: { $indexOfArray: ["$__recipes._id", "$$r.recipe"] },
                    },
                    in: {
                      $cond: [
                        { $gte: ["$$idx", 0] },
                        {
                          $let: {
                            vars: {
                              d: { $arrayElemAt: ["$__recipes", "$$idx"] },
                            },
                            in: {
                              _id: "$$d._id",
                              title: "$$d.title",
                              image: { $ifNull: ["$$d.image", ""] },
                            },
                          },
                        },
                        null,
                      ],
                    },
                  },
                },
                ingredients: {
                  $map: {
                    input: { $ifNull: ["$$r.ingredients", []] },
                    as: "ing",
                    in: {
                      $mergeObjects: [
                        "$$ing",
                        {
                          icon: { $ifNull: ["$$ing.icon", ""] },
                          checked: { $ifNull: ["$$ing.checked", false] },
                        },
                      ],
                    },
                  },
                },
              },
            ],
          },
        },
      },
    },
  },
  { $project: { __recipes: 0 } },
];

module.exports = {
  lookupOne,
  lookupMany,
  babyPopulateStages,
  babyDocumentDefaults,
  leanGroceryRecipeStages,
  recipeDocumentDefaults,
  groceryRecipeStages,
};
