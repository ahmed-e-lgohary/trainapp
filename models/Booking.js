const mongoose = require('mongoose')
const { randomUUID } = require('crypto')

const bookingSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: false, // ✅ مش إلزامي
      index: true,
      default: null,
    },

    trip: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Trip',
      required: true,
      index: true,
    },

    seats: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Seat',
      },
    ],

    bookingSegments: [
      {
        seat: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Seat',
          required: false,
        },
        fromStation: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Station',
          required: false,
        },
        toStation: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Station',
          required: false,
        },
        fromIndex: { type: Number, required: false },
        toIndex: { type: Number, required: false },
        price: { type: Number, required: false },
      },
    ],

    passengers: [
      {
        name: { type: String, required: true, trim: true },
        middleName: String,
        phone: String,
        email: { type: String, lowercase: true, trim: true },
        nationalId: String,
        nationality: String,
        profileType: String,
        age: Number,
        gender: { type: String, enum: ['male', 'female'] },

        bookingSegmentIndex: { type: Number, default: 0 }, // ✅ النظام يضيفها تلقائيًا
        ticketCode: { type: String, index: true },
        ticketPrice: { type: Number, default: 0 },

        cancelled: { type: Boolean, default: false },
        cancelledAt: Date,
        cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

        refunded: { type: Boolean, default: false },
        refundPending: { type: Boolean, default: false },
      },
    ],

    paymentStatus: {
      type: String,
      enum: [
        'pending',
        'paid',
        'failed',
        'refund_pending',
        'refunded',
        'partial_refunded',
        'refund_failed',
        'unpaid', // ✅ أضفنا unpaid
      ],
      default: 'pending',
      index: true,
    },

    transactionId: { type: String, index: true, sparse: true, default: null },
    paidAt: Date,
    refundedAt: Date,

    status: {
      type: String,
      enum: ['active', 'cancelled', 'completed', 'cancelling'],
      default: 'active',
      index: true,
    },

    cancelledAt: Date,
    completedAt: Date,

    qrCode: String,
    used: { type: Boolean, default: false, index: true },
    usedAt: Date,

    bookingRef: { type: String, unique: true, index: true },

    expiresAt: { type: Date, index: true },
    deleted: { type: Boolean, default: false, index: true },
  },
  { timestamps: true, optimisticConcurrency: true }
)

bookingSchema.pre('save', async function () {
  if (!this.bookingRef) {
    this.bookingRef = 'BK-' + randomUUID()
  }
})

module.exports = mongoose.model('Booking', bookingSchema)
