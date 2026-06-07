const express = require('express')
const router = express.Router()
const ServicesController = require('../controllers/Services')
const { authMiddleware } = require('../middleware/auth')

const userOnly = [authMiddleware]

const Trip = require('../models/Trip')

// استدعاء الدالة من نفس الملف أو من controller
const updateAllTrips = async () => {
  try {
    console.log('Updating all trips to start from today...')

    const trips = await Trip.find().sort({ departureDate: 1 })
    if (!trips.length) {
      console.log('No trips found')
      return
    }

    // البداية من اليوم الحالي الساعة 7 صباحًا
    const today = new Date()
    today.setHours(7, 0, 0, 0)

    for (let i = 0; i < trips.length && i < 30; i++) {
      // كل رحلة تزحزح يوم واحد للأمام
      const newDeparture = new Date(today)
      newDeparture.setDate(today.getDate() + i)

      const newArrival = new Date(newDeparture.getTime() + 12 * 60 * 60 * 1000)

      // لو عندها stops نزحزحها بنفس الفرق
      let updatedStops = []
      if (Array.isArray(trips[i].stops)) {
        updatedStops = trips[i].stops.map((stop, idx) => {
          const arrival = new Date(
            newDeparture.getTime() + (idx * 2 * 60 * 60 * 1000 + 30 * 60 * 1000)
          )
          const departure = new Date(arrival.getTime() + 10 * 60 * 1000)
          return { ...stop, arrivalTime: arrival, departureTime: departure }
        })
      }

      await Trip.updateOne(
        { _id: trips[i]._id },
        {
          departureDate: newDeparture,
          arrivalDate: newArrival,
          stops: updatedStops,
          deleted: false,
          status: 'scheduled',
          updatedAt: new Date(),
        }
      )
    }

    console.log('All trips updated to start from today')
  } catch (err) {
    console.error('Error updating trips:', err.message)
  }
}

// =====================================================
// Route لتشغيل التحديث مرة واحدة
// =====================================================
router.post('/updateAllTrips', async (req, res) => {
  try {
    await updateAllTrips()
    res.json({ success: true, msg: 'All trips updated to start from today' })
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message })
  }
})

const diversifyTrips = async () => {
  const Train = require('../models/Train')
  const Seat = require('../models/Seat')
  
  const trains = await Train.find({ deleted: { $ne: true } })
  if (trains.length === 0) {
    throw new Error('No trains found in database')
  }

  // Align train class seat counts to client rules
  for (const train of trains) {
    let classes = { VIP: 0, First: 0, Second: 0 }
    
    if (train.type === 'Talgo') {
      classes.First = 32
      classes.Second = 44
    } else if (train.type === 'Spanish') {
      classes.First = 47
      classes.Second = 60
    } else if (train.type === 'French') {
      classes.First = 47
      classes.Second = 64
    } else if (train.type === 'VIP') {
      classes.VIP = 47
      classes.Second = 64
    } else if (train.type === 'Russian') {
      classes.Second = 88
    } else {
      classes.First = 47
      classes.Second = 64
    }

    train.classes = classes
    train.totalSeats = classes.VIP + classes.First + classes.Second
    await train.save()
  }

  const trips = await Trip.find({ deleted: { $ne: true } })
  
  const generateSeatsForTrip = async (trainDoc, tripId, basePrice) => {
    const seats = [];
    let seatNumber = 1;
    const vipCount = trainDoc.classes?.VIP || 0;
    for (let i = 0; i < vipCount; i++) {
      seats.push({ trip: tripId, train: trainDoc._id, seatNumber: seatNumber++, classType: 'VIP', seatType: (i % 3) === 1 ? 'Aisle' : 'Window', price: Math.round(basePrice * 1.5), status: 'available', deleted: false });
    }
    const firstCount = trainDoc.classes?.First || 0;
    for (let i = 0; i < firstCount; i++) {
      seats.push({ trip: tripId, train: trainDoc._id, seatNumber: seatNumber++, classType: 'First', seatType: (i % 3) === 1 ? 'Aisle' : 'Window', price: Math.round(basePrice * 1.2), status: 'available', deleted: false });
    }
    const secondCount = trainDoc.classes?.Second || 0;
    for (let i = 0; i < secondCount; i++) {
      seats.push({ trip: tripId, train: trainDoc._id, seatNumber: seatNumber++, classType: 'Second', seatType: (i % 4) === 0 || (i % 4) === 3 ? 'Window' : 'Aisle', price: basePrice, status: 'available', deleted: false });
    }
    if (seats.length > 0) {
      await Seat.insertMany(seats);
    }
  };

  for (let i = 0; i < trips.length; i++) {
    const trip = trips[i]
    const randomTrain = trains[Math.floor(Math.random() * trains.length)]
    
    await Trip.updateOne({ _id: trip._id }, { train: randomTrain._id })
    await Seat.deleteMany({ trip: trip._id })
    await generateSeatsForTrip(randomTrain, trip._id, trip.price)
  }
}

router.post('/diversifyTrips', async (req, res) => {
  try {
    await diversifyTrips()
    res.json({ success: true, msg: 'All trips diversified with random trains and seats rebuilt successfully!' })
  } catch (err) {
    res.status(500).json({ success: false, msg: err.message })
  }
})

router.get('/trips/search', ServicesController.searchTrips)

router.get('/trips/:tripId/route', ServicesController.getTripStops)
router.get('/stations', ServicesController.getAllStations)
router.get('/destinations', ServicesController.getValidDestinations)
router.get('/trips/seats', ServicesController.getSeatsByTrip)
router.get('/trips/:tripId/seats', ServicesController.getSeatsByTrip)
// ✅ بدون next
router.post('/seats/:seatId/hold', ServicesController.bookOrHoldSeatWithPayment)

router.post('/bookings', ...userOnly, ServicesController.getMyBookById)

router.delete('/bookings/:id', ServicesController.cancelBooking)

module.exports = router

//! 7 Methods :
//?----------------
//todo searchTrips
//todo cancelBooking
//todo getMyBooks
//todo holdSeat
//todo getSeatsByTrip
//todo getTripRoute
//todo confirmPayment
//?----------------
