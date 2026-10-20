const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const moment = require("moment-timezone");
const validator = require("validator");
const { randomBytes } = require("crypto");

const subscriptionSchema = new mongoose.Schema(
  {
    subscription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subscription",
    },

    startDate: {
      type: Date,
      default: Date.now,
    },

    endDate: {
      type: Date,
      default: null,
    },

    status: {
      type: String,
      enum: ["active", "expired", "cancelled"],
      default: "active",
    },

    paymentId: {
      type: String,
      default: "",
    },
  },
  {
    _id: false,
  },
);

const userSchema = new mongoose.Schema(
  {
    profileIcon: {
      type: String,
      default: "",
    },

    name: {
      type: String,
      default: "",
    },
    email: {
      type: String,
      required: [true, "email_required"],
      unique: true,
      validate: {
        validator: function (value) {
          return validator.isEmail(value);
        },
        message: "email_invalid",
      },
    },
    previousEmail: {
      type: String,
      default: "",
    },
    phoneNumber: {
      type: String,
      default: "",
    },

    deviceInfo: {
      deviceId: {
        type: String,
        default: "",
      },
      deviceType: {
        type: String,
        enum: ["android", "ios", "web"],
        default: "web",
      },
    },

    parentCaregiverName: {
      type: String,
      default: "",
    },

    acceptTerms: {
      type: Boolean,
      default: false,
    },

    verificationStatus: {
      email: {
        type: String,
        enum: ["pending", "verified", "rejected"],
        default: "pending",
      },
      phoneNumber: {
        type: String,
        enum: ["pending", "verified", "rejected"],
        default: "pending",
      },
    },

    password: {
      type: String,
      default: "",
    },

    accountState: {
      userType: {
        type: String,
        enum: ["user", "admin"],
        default: "user",
      },
      status: {
        type: String,
        enum: [
          "active",
          "inactive",
          "suspended",
          "softDeleted",
          "hardDeleted",
          "restricted",
        ],
        default: "active",
      },
      reason: {
        type: String,
        default: "",
      },
      suspensionDate: {
        type: Date,
      },
      finalDeletionDate: {
        type: Date,
      },
    },

    activeBaby: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Baby",
      default: null,
    },

    otpInfo: {
      emailOtp: {
        otp: {
          type: String,
          default: "",
        },
        otpUsed: {
          type: Boolean,
          default: false,
        },
        otpExpires: {
          type: Date,
        },
        otpRequestCount: {
          type: Number,
          default: 0,
        },
        otpRequestTimestamp: {
          type: Date,
          default: Date.now,
        },
      },
      phoneNumberOtp: {
        otp: {
          type: String,
          default: "",
        },
        otpUsed: {
          type: Boolean,
          default: false,
        },
        otpExpires: {
          type: Date,
        },
        otpRequestCount: {
          type: Number,
          default: 0,
        },
        otpRequestTimestamp: {
          type: Date,
          default: Date.now,
        },
      },
    },

    resetToken: {
      type: String,
      default: "",
    },
    timezone: {
      type: String,
      default: "",
      required: true,
    },
    language: {
      type: String,
      default: "en",
    },

    onboarding: {
      selectedCountries: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Country",
        },
      ],
      completed: {
        type: Boolean,
        default: false,
      },
    },

    blockedUsers: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
    },
    reportCount: {
      type: Number,
      default: 0,
    },
    reportedBy: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
      ],
      default: [],
    },

    subscriptions: {
      type: [subscriptionSchema],
      default: [],
    },

    provider: {
      type: String,
      enum: ["google", "facebook", "apple", "email"],
      default: "email",
    },
    googleId: {
      type: String,
      default: null,
    },
    facebookId: {
      type: String,
      default: null,
    },
    appleId: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

userSchema.pre("save", async function (next) {
  const user = this;
  if (this.phoneNumber === "") {
    this.phoneNumber = null;
  }
  if (user.isModified("password")) {
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(user.password, salt);
  }
  if (user.isModified("email")) {
    user.email = user.email.toLowerCase().trim();
  }

  next();
});

userSchema.methods.generateAuthToken = function () {
  const user = this;
  const token = jwt.sign({ _id: user._id }, process.env.JWT_SECRET);
  return token;
};

userSchema.statics.findByCredentials = async (email, password) => {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();
  const user = await User.findOne({ email: normalizedEmail });

  if (!user) {
    return { error: "user_not_found" };
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return { error: "incorrect_password" };
  }

  return user;
};

userSchema.methods.generateOtp = function (type = "email", timezone = "UTC") {
  const user = this;
  const now = Date.now();
  const allowedOtpRequests = 3;

  let otpRequestCount, otpRequestTimestamp;

  if (type === "email") {
    otpRequestCount = user.otpInfo.emailOtp.otpRequestCount;
    otpRequestTimestamp = user.otpInfo.emailOtp.otpRequestTimestamp;
  } else if (type === "phoneNumber") {
    otpRequestCount = user.otpInfo.phoneNumberOtp.otpRequestCount;
    otpRequestTimestamp = user.otpInfo.phoneNumberOtp.otpRequestTimestamp;
  }

  const timeLimit = moment(otpRequestTimestamp).add(1, "hour").valueOf();
  if (now > timeLimit) {
    if (type === "email") {
      user.otpInfo.emailOtp.otpRequestCount = 0;
      user.otpInfo.emailOtp.otpRequestTimestamp = now;
    } else if (type === "phoneNumber") {
      user.otpInfo.phoneNumberOtp.otpRequestCount = 0;
      user.otpInfo.phoneNumberOtp.otpRequestTimestamp = now;
    }
  } else if (otpRequestCount >= allowedOtpRequests) {
    if (process.env.NODE_ENV == "prod") {
      return { error: "too_many_otp_requests" };
    }
  }

  if (type === "email") {
    user.otpInfo.emailOtp.otpRequestCount += 1;
  } else if (type === "phoneNumber") {
    user.otpInfo.phoneNumberOtp.otpRequestCount += 1;
  }

  const otp = (parseInt(randomBytes(3).toString("hex"), 16) % 1000000)
    .toString()
    .padStart(6, "0");

  const otpExpires = moment
    .tz(now, timezone)
    .add(type === "email" ? 10 : 5, "minutes")
    .valueOf();

  if (type === "email") {
    user.otpInfo.emailOtp.otp = otp;
    user.otpInfo.emailOtp.otpExpires = otpExpires;
    user.otpInfo.emailOtp.otpUsed = false;
  } else if (type === "phoneNumber") {
    user.otpInfo.phoneNumberOtp.otp = otp;
    user.otpInfo.phoneNumberOtp.otpExpires = otpExpires;
    user.otpInfo.phoneNumberOtp.otpUsed = false;
  }

  return otp;
};

const generateResetToken = () => {
  return randomBytes(32).toString("hex");
};

const User = mongoose.models.User || mongoose.model("User", userSchema);

module.exports = { User, generateResetToken };
