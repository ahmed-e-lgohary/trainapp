const mongoose = require('mongoose')

const tripSchema = new mongoose.Schema(
  {
    route: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Route',
      required: true,
    },
    train: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Train',
      required: true,
    },
    fromStation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Station',
      required: true,
    },
    toStation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Station',
      required: true,
    },
    fromIndex: { type: Number, required: true },
    toIndex: { type: Number, required: true },
    departureDate: { type: Date, required: true },
    arrivalDate: { type: Date, required: true },
    durationMinutes: { type: Number, required: true },
    price: { type: Number, required: true },

    stops: [
      {
        station: { type: mongoose.Schema.Types.ObjectId, ref: 'Station' }, // ✅ الحقل الجديد
        arrivalTime: Date,
        departureTime: Date,
        order: Number,
      },
    ],

    status: { type: String, default: 'scheduled' },
    archived: { type: Boolean, default: false },
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Trip', tripSchema)
