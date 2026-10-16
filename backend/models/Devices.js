const mongoose = require("mongoose");

const DeviceSchema = mongoose.Schema({
  deviceId: {
    type: String,
    default: "",
    required: [true, "device_id_required"],
  },
  deviceType: {
    type: String,
    enum: ["android", "ios"],
    default: "android",
    required: [true, "device_type_required"],
  },
});

const DevicesSchema = mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    devices: [DeviceSchema], // Array of device objects
  },
  {
    timestamps: true,
  },
);

const Devices = mongoose.model("device", DevicesSchema);

// Function to add a device after checking for duplicate deviceId
async function createOrSkipDevice(userId, deviceId, deviceType) {
  try {
    if (!deviceId || deviceId === "test") {
      return;
    }

    await Devices.updateOne(
      {
        userId,
        "devices.deviceId": {
          $ne: deviceId,
        },
      },
      {
        $push: {
          devices: {
            deviceId,
            deviceType,
          },
        },
      },
      {
        upsert: true,
      },
    );
  } catch (error) {
    console.error("Error adding device:", error);
    throw error;
  }
}

module.exports = {
  Devices,
  createOrSkipDevice,
};
