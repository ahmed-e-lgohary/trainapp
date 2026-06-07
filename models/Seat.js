const mongoose = require('mongoose')

const seatSchema = new mongoose.Schema(
  {
    train: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Train',
      required: true,
      index: true,
    },
    trip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: true,
      index: true,
    },
    seatNumber: { type: Number, required: true },
    classType: { type: String, required: true },
    seatType: {
      type: String,
      enum: ['Window', 'Middle', 'Aisle', 'Standard'],
      default: 'Standard',
    },
    status: {
      type: String,
      enum: ['available', 'reserved', 'booked'],
      default: 'available',
    },
    reservedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    price: { type: Number },
    deleted: { type: Boolean, default: false },
  },
  { timestamps: true }
)

module.exports = mongoose.model('Seat', seatSchema)
