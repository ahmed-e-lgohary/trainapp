const mongoose = require("mongoose");

const trainSchema = new mongoose.Schema(
  {
    // =====================================================
    // BASIC INFO
    // =====================================================

    number: {
      type: Number,
      required: true,
      unique: true,
      index: true,
      min: 1,
    },

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 100,
    },

    // =====================================================
    // TRAIN TYPE
    // =====================================================

    type: {
      type: String,

      enum: [
        "VIP",
        "Spanish",
        "French",
        "Russian",
        "Talgo",
        "Express",
        "Local",
        "Sleeper",
      ],

      required: true,

      index: true,
    },

    // =====================================================
    // OPERATION STATUS
    // =====================================================

    status: {
      type: String,

      enum: ["active", "maintenance", "disabled"],

      default: "active",

      index: true,
    },

    // =====================================================
    // CLASS CONFIGURATION
    // seats count PER CLASS
    // =====================================================

    classes: {
      VIP: {
        type: Number,
        default: 0,
        min: 0,
      },

      First: {
        type: Number,
        default: 0,
        min: 0,
      },

      Second: {
        type: Number,
        default: 0,
        min: 0,
      },
    },

    // =====================================================
    // TOTAL SEATS
    // auto-generated from classes
    // =====================================================

    totalSeats: {
      type: Number,
      default: 0,
      min: 1,
      index: true,
    },

    // =====================================================
    // COACH COUNT
    // =====================================================

    coaches: {
      type: Number,
      default: 1,
      min: 1,
    },

    // =====================================================
    // LAYOUT TYPE
    // =====================================================

    layout: {
      type: String,

      enum: ["standard", "vip", "talgo", "sleeper"],

      default: "standard",
    },

    // =====================================================
    // SPEED
    // =====================================================

    averageSpeed: {
      type: Number,
      default: 120,
      min: 40,
    },

    // =====================================================
    // FEATURES
    // =====================================================

    features: {
      wifi: {
        type: Boolean,
        default: false,
      },

      airConditioned: {
        type: Boolean,
        default: true,
      },

      buffet: {
        type: Boolean,
        default: false,
      },

      sleeper: {
        type: Boolean,
        default: false,
      },
    },

    // =====================================================
    // SEARCH HELPERS
    // =====================================================

    searchableName: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
    },

    // =====================================================
    // SOFT DELETE
    // =====================================================

    deleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },

  {
    timestamps: true,

    toJSON: {
      virtuals: true,
    },

    toObject: {
      virtuals: true,
    },
  },
);

// =====================================================
// VIRTUALS
// =====================================================

trainSchema.virtual("displayName").get(function () {
  return `${this.name} (#${this.number})`;
});

// =====================================================
// AUTO CALCULATE TOTAL SEATS
// =====================================================

trainSchema.pre("save", function (next) {
  this.totalSeats =
    (this.classes?.VIP || 0) +
    (this.classes?.First || 0) +
    (this.classes?.Second || 0);

  this.searchableName = this.name.toLowerCase();

  if (typeof next === 'function') {
    next();
  }
});

// =====================================================
// INDEXES
// =====================================================

trainSchema.index({
  type: 1,
  status: 1,
  deleted: 1,
});

trainSchema.index({
  searchableName: 1,
});

// =====================================================
// EXPORT
// =====================================================

module.exports = mongoose.model("Train", trainSchema);
