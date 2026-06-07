const mongoose = require("mongoose");

const stationSchema = new mongoose.Schema(
  {
    // =====================================================
    // BASIC INFO
    // =====================================================

    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },

    normalizedName: {
      type: String,
      lowercase: true,
      trim: true,
      index: true,
    },

    code: {
      type: String,
      uppercase: true,
      trim: true,
      unique: true,
      sparse: true,
      index: true,
    },

    // =====================================================
    // LOCATION
    // =====================================================

    country: {
      type: String,
      required: true,
      trim: true,
      default: "Egypt",
      index: true,
    },

    governorate: {
      type: String,
      trim: true,
      index: true,
    },

    city: {
      type: String,
      trim: true,
      index: true,
    },

    address: {
      type: String,
      trim: true,
    },

    // =====================================================
    // GEO LOCATION
    // =====================================================

    coordinates: {
      type: {
        type: String,
        enum: ["Point"],
        default: "Point",
      },

      coordinates: {
        type: [Number],

        required: true,

        validate: {
          validator: function (value) {
            return (
              Array.isArray(value) &&
              value.length === 2 &&
              value[0] >= -180 &&
              value[0] <= 180 &&
              value[1] >= -90 &&
              value[1] <= 90
            );
          },

          message: "Invalid coordinates",
        },
      },
    },

    // =====================================================
    // SEARCH HELPERS
    // =====================================================

    aliases: [
      {
        type: String,
        lowercase: true,
        trim: true,
      },
    ],

    // =====================================================
    // OPERATION STATUS
    // =====================================================

    status: {
      type: String,

      enum: ["active", "inactive"],

      default: "active",

      index: true,
    },

    // =====================================================
    // TIMEZONE
    // =====================================================

    timezone: {
      type: String,
      default: "Africa/Cairo",
    },

    // =====================================================
    // DISPLAY ORDER
    // useful later in route sorting
    // =====================================================

    priority: {
      type: Number,
      default: 0,
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
// GEO INDEX
// =====================================================

stationSchema.index({
  coordinates: "2dsphere",
});

// =====================================================
// SEARCH INDEXES
// =====================================================

stationSchema.index({
  normalizedName: 1,
  deleted: 1,
});

stationSchema.index({
  city: 1,
  governorate: 1,
});

// =====================================================
// UNIQUE ACTIVE NAME
// prevents duplicate active stations
// =====================================================

stationSchema.index(
  {
    normalizedName: 1,
    deleted: 1,
  },
  {
    unique: true,
  },
);

// =====================================================
// AUTO NORMALIZE
// =====================================================

stationSchema.pre("save", function (next) {
  this.normalizedName = this.name.toLowerCase().trim();

  if (typeof next === 'function') {
    next();
  }
});

// =====================================================
// VIRTUAL
// =====================================================

stationSchema.virtual("displayName").get(function () {
  return this.name
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
});

// =====================================================
// EXPORT
// =====================================================

module.exports = mongoose.model("Station", stationSchema);
