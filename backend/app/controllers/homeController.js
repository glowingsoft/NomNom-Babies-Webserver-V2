const Baby = require("@models/Baby");
const Recipe = require("@models/Recipe");
const Nutrition = require("@models/Nutrition");
const FeedingLog = require("@models/FeedingLog");
const FeedingSchedule = require("@models/FeedingSchedule");
const moment = require("moment");

const { User } = require("@models/UserModel");
const { sendResponse } = require("@utils/responseUtil");
const FoodTracker = require("@models/FoodTracker");
const { getBabyInfo, babyPopulate } = require("@utils/babyUtil");

const dayNames = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const getHome = async (req, res) => {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user?.activeBaby) {
      return sendResponse({
        res,
        statusCode: 200,
        translationKey: "data_fetched_successfully",
        data: {
          hasBaby: false,
        },
      });
    }

    const baby = await Baby.findById(user.activeBaby).populate(babyPopulate);

    if (!baby) {
      return sendResponse({
        res,
        statusCode: 404,
        translationKey: "baby_not_found",
      });
    }

    const today = new Date().toISOString().split("T")[0];

    const [
      feedingSchedule,
      todayLogs,
      allLogs,
      culturalRecipes,
      weeklyFocus,
      foodTracker,
    ] = await Promise.all([
      FeedingSchedule.find({
        baby: baby._id,
      }).sort({ date: 1, time: 1 }),

      FeedingLog.find({
        baby: baby._id,
        user: userId,
        date: today,
      }),

      FeedingLog.find({
        baby: baby._id,
        user: userId,
      }),

      Recipe.find({
        country: {
          $in: baby.selectedCountries.map((c) => c._id),
        },
        babyStage: baby.babyStage?._id,
        status: "published",
        isActive: true,
      })
        .populate("country")
        .limit(6),

      Nutrition.findOne({
        isWeeklyFocus: true,
        isActive: true,
      }).populate("recipe"),

      FoodTracker.find({
        baby: baby._id,
        user: userId,
      })
        .sort({ date: -1 })
        .limit(5),
    ]);

    const completedSlotIds = new Set(
      todayLogs.map((log) => String(log.slotId)),
    );

    const todaySchedule = feedingSchedule.filter((item) => item.date === today);

    const recommendedMeals =
      todaySchedule.map((slot) => ({
        _id: slot._id,
        type: slot.type,
        title: slot.title,
        description: slot.description,
        time: slot.time,
        completed: completedSlotIds.has(String(slot._id)),
      })) || [];

    const nextMeal =
      todaySchedule
        .filter((slot) => !completedSlotIds.has(String(slot._id)))
        .sort(
          (a, b) => moment(a.time, "hh:mm A") - moment(b.time, "hh:mm A"),
        )[0] || null;

    const groupedSchedules = {};

    feedingSchedule.forEach((slot) => {
      if (!groupedSchedules[slot.date]) {
        groupedSchedules[slot.date] = [];
      }

      groupedSchedules[slot.date].push(slot);
    });

    const weeklyJourney = Object.keys(groupedSchedules)
      .sort()
      .map((date, index) => {
        const slots = groupedSchedules[date];

        const completedSlots = slots.filter((slot) =>
          allLogs.some(
            (log) =>
              String(log.slotId) === String(slot._id) && log.date === date,
          ),
        ).length;

        const jsDay = new Date(date).getDay();

        return {
          dayName: dayNames[jsDay === 0 ? 6 : jsDay - 1],
          date,
          totalSlots: slots.length,
          completedSlots,
          completed: slots.length > 0 && completedSlots === slots.length,
        };
      });

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "data_fetched_successfully",
      data: {
        babyInfo: getBabyInfo(baby),

        recommendedToday: recommendedMeals,

        weeklyJourney,

        customCulturalPicks: culturalRecipes.map((recipe) => ({
          _id: recipe._id,
          title: recipe.title,
          image: recipe.image,
          mealType: recipe.mealType,
          prepTime: recipe.prepTime,
          country: recipe.country?.name || "",
        })),

        foodTracker: foodTracker.map((item) => ({
          _id: item._id,
          ingredientName: item.ingredientName,
          image: item.image,
          date: item.date,
          reaction: item.reaction,
        })),

        weeklyFocus: weeklyFocus
          ? {
              recipe: weeklyFocus.recipe?.title || "",
              nutrients: weeklyFocus.nutrients || [],
              feedingInsight: weeklyFocus.feedingInsight,
              allergyReminder: weeklyFocus.allergyReminder,
            }
          : null,

        nextMeal: nextMeal ? {
          _id: nextMeal._id,
          type: nextMeal.type,
          title: nextMeal.title,
          description: nextMeal.description,
          time: nextMeal.time,
          isOptional: nextMeal.isOptional,
        } : null,
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
  getHome,
};
