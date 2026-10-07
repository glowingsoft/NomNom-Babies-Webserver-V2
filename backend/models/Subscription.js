const mongoose = require("mongoose");

const subscriptionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    price: {
      type: Number,
      required: true,
    },

    currency: {
      type: String,
      default: "$",
    },

    billingCycle: {
      type: String,
      enum: ["month", "year"],
      default: "month",
    },

    badge: {
      type: String,
      default: "",
    },

    features: [
      {
        type: String,
      },
    ],

    sortOrder: {
      type: Number,
      default: 1,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },

  {
    timestamps: true,
  },
);

module.exports =
  mongoose.models.Subscription ||
  mongoose.model("Subscription", subscriptionSchema);
