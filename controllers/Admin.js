const mongoose = require('mongoose')
const Trip = require('../models/Trip')
const Station = require('../models/Station')
const Seat = require('../models/Seat')
const bcrypt = require('bcryptjs')
const Train = require('../models/Train')
const User = require('../models/User')
const Booking = require('../models/Booking')
const { sendEmail } = require('../services/emailService')
const { sendSMS } = require('../services/smsService')
const {
  generateOTP,
  hashOTP,
  extractDOBFromNationalId,
} = require('../utils/authHelpers')
const send = (
  res,
  { success = true, msg = '', data = null, count, status = 200 } = {}
) => {
  const safeStatus = Number.isInteger(status) ? status : 200

  return res.status(safeStatus).json({
    success,
    msg,
    ...(count !== undefined && { count }),
    data,
  })
}
exports.createStations = async (req, res) => {
  try {
    const { stations } = req.body

    if (!Array.isArray(stations) || stations.length === 0) {
      return send(res, {
        success: false,
        msg: 'Stations array required',
        status: 400,
      })
    }

    const ops = []

    for (const s of stations) {
      if (!s.name?.trim()) continue

      const normalizedName = s.name.trim().toLowerCase()

      const validCoords =
        Array.isArray(s.coordinates) &&
        s.coordinates.length === 2 &&
        typeof s.coordinates[0] === 'number' &&
        typeof s.coordinates[1] === 'number'

      const update = {
        name: s.name.trim(),
        normalizedName,
        location: s.location?.trim() || '',
        status: s.status || 'active',
      }

      if (validCoords) {
        update.coordinates = {
          type: 'Point',
          coordinates: s.coordinates,
        }
      }

      ops.push({
        updateOne: {
          filter: {
            normalizedName,
            deleted: false,
          },
          update: {
            $set: update,
          },
          upsert: true,
        },
      })
    }

    if (!ops.length) {
      return send(res, {
        success: false,
        msg: 'No valid stations',
        status: 400,
      })
    }

    const result = await Station.bulkWrite(ops, { ordered: false })

    const names = stations.map((s) => s.name.trim().toLowerCase())

    const updatedStations = await Station.find({
      normalizedName: { $in: names },
      deleted: false,
    })

    return send(res, {
      success: true,
      msg: 'Stations upserted',
      inserted: result.upsertedCount || 0,
      modified: result.modifiedCount || 0,
      data: updatedStations,
    })
  } catch (err) {
    return send(res, {
      success: false,
      msg: err.message,
      status: 500,
    })
  }
}
exports.createStation = async (req, res) => {
  try {
    const { name, location, coordinates, status } = req.body

    if (!name?.trim()) {
      return send(res, {
        success: false,
        msg: 'Station name required',
        status: 400,
      })
    }

    const normalizedName = name.trim().toLowerCase()

    const validCoords =
      Array.isArray(coordinates) &&
      coordinates.length === 2 &&
      typeof coordinates[0] === 'number' &&
      typeof coordinates[1] === 'number'

    const update = {
      name: name.trim(),
      normalizedName,
      location: location?.trim() || '',
      status: status || 'active',
    }

    if (validCoords) {
      update.coordinates = {
        type: 'Point',
        coordinates,
      }
    }

    const station = await Station.findOneAndUpdate(
      {
        normalizedName,
        deleted: false,
      },
      {
        $set: update,
      },
      {
        new: true,
        upsert: true,
      }
    )

    return send(res, {
      success: true,
      msg: 'Station saved',
      data: station,
      status: 201,
    })
  } catch (err) {
    return send(res, {
      success: false,
      msg: err.message,
      status: 500,
    })
  }
}
exports.createTrains = async (req, res) => {
  try {
    const { trains } = req.body

    if (!Array.isArray(trains) || !trains.length) {
      return send(res, {
        success: false,
        msg: 'Invalid trains array',
        status: 400,
      })
    }

    const ops = []

    for (const t of trains) {
      if (!t.number || !t.name || !t.type) continue

      const update = {
        name: t.name.trim(),
        type: t.type,
        status: t.status || 'active',
        classes: {
          VIP: t.classes?.VIP || 0,
          First: t.classes?.First || 0,
          Second: t.classes?.Second || 0,
        },
        layout: t.layout || 'standard',
        seats: t.seats || 0,
      }

      ops.push({
        updateOne: {
          filter: {
            number: t.number,
            deleted: false,
          },
          update: {
            $set: update,
          },
          upsert: true,
        },
      })
    }

    if (!ops.length) {
      return send(res, {
        success: false,
        msg: 'No valid trains',
        status: 400,
      })
    }

    const result = await Train.bulkWrite(ops, { ordered: false })

    const numbers = trains.map((t) => t.number)

    const data = await Train.find({
      number: { $in: numbers },
      deleted: false,
    })

    return send(res, {
      success: true,
      msg: 'Trains upserted',
      inserted: result.upsertedCount || 0,
      modified: result.modifiedCount || 0,
      data,
    })
  } catch (err) {
    return send(res, {
      success: false,
      msg: err.message,
      status: 500,
    })
  }
}
exports.createTrain = async (req, res) => {
  try {
    const { number, name, type, classes, layout, status, seats } = req.body

    if (!number || !name || !type) {
      return send(res, {
        success: false,
        msg: 'Invalid input',
        status: 400,
      })
    }

    const update = {
      name: name.trim(),
      type,
      status: status || 'active',
      classes: {
        VIP: classes?.VIP || 0,
        First: classes?.First || 0,
        Second: classes?.Second || 0,
      },
      layout: layout || 'standard',
      seats: seats || 0,
    }

    const train = await Train.findOneAndUpdate(
      {
        number,
        deleted: false,
      },
      {
        $set: update,
      },
      {
        new: true,
        upsert: true,
      }
    )

    return send(res, {
      success: true,
      msg: 'Train saved',
      data: train,
      status: 201,
    })
  } catch (err) {
    return send(res, {
      success: false,
      msg: err.message,
      status: 500,
    })
  }
}
const generateTalgoSeats = (train, tripId, basePrice) => {
  if (!tripId) return []

  const seats = []
  let seatNumber = 1
  const type = train.type?.toLowerCase()

  if (type === 'talgo') {
    // First Class
    for (let i = 0; i < 20; i++) {
      const seatType = i % 2 === 0 ? 'Window' : 'Aisle'
      seats.push({
        trip: tripId,
        train: train._id,
        seatNumber: seatNumber++,
        classType: 'First',
        seatType,
        price: Math.round(basePrice * 2),
        status: 'available',
        deleted: false,
      })
    }

    // Second Class
    for (let i = 0; i < 40; i++) {
      let seatType
      if (i % 3 === 0) seatType = 'Window'
      else if (i % 3 === 1) seatType = 'Middle'
      else seatType = 'Aisle'

      seats.push({
        trip: tripId,
        train: train._id,
        seatNumber: seatNumber++,
        classType: 'Second',
        seatType,
        price: basePrice,
        status: 'available',
        deleted: false,
      })
    }
  }

  return seats
}

const buildRouteStops = (routeStations, fromIndex, toIndex, departureDate) => {
  if (!Array.isArray(routeStations)) return []

  const start = Math.min(fromIndex, toIndex)
  const end = Math.max(fromIndex, toIndex)

  const segment = routeStations
    .filter((s) => s.order >= start && s.order <= end)
    .sort((a, b) => a.order - b.order)

  return segment.map((s, i) => ({
    station: s.station,
    order: i,
    arrivalTime: new Date(departureDate),
    departureTime: new Date(departureDate),
    distanceFromStart: s.order,
  }))
}
exports.createTrip = async (req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const {
      routeStations,
      train,
      fromStation,
      toStation,
      fromIndex,
      toIndex,
      departureDate,
      arrivalDate,
      price,
    } = req.body

    if (
      !routeStations ||
      !train ||
      fromIndex == null ||
      toIndex == null ||
      !departureDate ||
      !arrivalDate ||
      !price
    ) {
      throw new Error('Missing required fields')
    }

    const dep = new Date(departureDate)
    const arr = new Date(arrivalDate)
    if (arr <= dep) throw new Error('Invalid time range')

    const trainDoc = await Train.findById(train).session(session)
    if (!trainDoc) throw new Error('Train not found')

    const routeStops = buildRouteStops(routeStations, fromIndex, toIndex, dep)
    const durationMinutes = Math.floor((arr - dep) / 60000)

    const [trip] = await Trip.create(
      [
        {
          route: trainDoc.route,
          train,
          fromStation,
          toStation,
          fromIndex,
          toIndex,
          departureDate: dep,
          arrivalDate: arr,
          durationMinutes,
          price,
          routeStops,
          status: 'scheduled',
          archived: false,
          deleted: false,
        },
      ],
      { session }
    )

    const seats = generateTalgoSeats(trainDoc, trip._id, price)
    await Seat.insertMany(seats, { session })

    await session.commitTransaction()
    session.endSession()

    return res.json({
      success: true,
      msg: 'Trip created successfully',
      data: trip,
    })
  } catch (err) {
    await session.abortTransaction()
    session.endSession()
    return res.status(500).json({ success: false, msg: err.message })
  }
}

// إنشاء الرحلات مع الـ stops + توليد 30 يوم
exports.createTripsWithStops = async (req, res) => {
  try {
    const {
      train,
      fromStation,
      toStation,
      departureDate,
      arrivalDate,
      price,
      stops = [],
    } = req.body

    if (
      !train ||
      !fromStation ||
      !toStation ||
      !departureDate ||
      !arrivalDate
    ) {
      return res
        .status(400)
        .json({ success: false, msg: 'Missing required fields' })
    }

    const baseDate = new Date(departureDate)

    const baseTrip = await Trip.create({
      train,
      fromStation,
      toStation,
      departureDate,
      arrivalDate,
      price,
      routeStops: stops,
    })

    for (let i = 0; i < stops.length; i++) {
      const stop = stops[i]

      await Trip.create({
        train,
        fromStation: i === 0 ? fromStation : stops[i - 1].station,
        toStation: stop.station,
        departureDate: stop.arrivalTime,
        arrivalDate: stop.departureTime,
        price,
      })

      const nextStation =
        i === stops.length - 1 ? toStation : stops[i + 1].station
      await Trip.create({
        train,
        fromStation: stop.station,
        toStation: nextStation,
        departureDate: stop.departureTime,
        arrivalDate: stops[i + 1] ? stops[i + 1].arrivalTime : arrivalDate,
        price,
      })
    }

    for (let d = 1; d <= 30; d++) {
      const newDate = new Date(baseDate)
      newDate.setDate(newDate.getDate() + d)

      const newDeparture = new Date(newDate)
      newDeparture.setHours(baseDate.getHours(), baseDate.getMinutes())

      const newArrival = new Date(newDate)
      newArrival.setHours(arrivalDate.getHours(), arrivalDate.getMinutes())

      await Trip.create({
        train,
        fromStation,
        toStation,
        departureDate: newDeparture,
        arrivalDate: newArrival,
        price,
        routeStops: stops,
      })
    }

    return res
      .status(201)
      .json({
        success: true,
        msg: 'Trips created successfully',
        data: baseTrip,
      })
  } catch (err) {
    return res.status(500).json({ success: false, msg: err.message })
  }
}

exports.updateCompletedTrips = async () => {
  try {
    const result = await Trip.updateMany(
      {
        departureDate: { $lt: new Date() },
        status: 'scheduled',
      },
      {
        $set: { status: 'completed' },
      }
    )

    console.log(`Completed trips updated: ${result.modifiedCount}`)
  } catch (err) {
    console.log(err)
  }
}
exports.archiveOldTrips = async () => {
  try {
    const oldDate = new Date()
    oldDate.setDate(oldDate.getDate() - 30)

    const result = await Trip.updateMany(
      {
        departureDate: { $lt: oldDate },
        status: 'completed',
        archived: false,
      },
      {
        $set: { archived: true },
      }
    )

    console.log(`Trips archived: ${result.modifiedCount}`)
  } catch (err) {
    console.log(err)
  }
}
exports.adminManageSeats = async (req, res) => {
  try {
    const { seats } = req.body

    if (!Array.isArray(seats) || !seats.length) {
      return sendRes(res, 400, false, 'Seats array required')
    }

    const operations = []

    for (const s of seats) {
      const { seatId, updates } = s

      if (!mongoose.Types.ObjectId.isValid(seatId)) {
        throw new Error('Invalid seatId')
      }

      const forbiddenFields = ['seatNumber', 'trip', 'classType']

      for (const key of Object.keys(updates || {})) {
        if (forbiddenFields.includes(key)) {
          throw new Error(`Cannot update protected field: ${key}`)
        }
      }

      operations.push({
        updateOne: {
          filter: { _id: seatId },
          update: { $set: updates },
        },
      })
    }

    const result = await Seat.bulkWrite(operations)

    return sendRes(res, 200, true, 'Seats updated', {
      modified: result.modifiedCount,
    })
  } catch (err) {
    return sendRes(res, 500, false, err.message)
  }
}
exports.getTripById = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return send(res, { success: false, msg: 'Invalid trip ID', status: 400 })
    }

    const trip = await Trip.findOne({ _id: id, deleted: false })
      .populate('train fromStation toStation routeStops.station')
      .lean()

    if (!trip) {
      return send(res, { success: false, msg: 'Trip not found', status: 404 })
    }

    const durationMs = new Date(trip.arrivalDate) - new Date(trip.departureDate)
    const hours = Math.floor(durationMs / 3600000)
    const minutes = Math.floor((durationMs % 3600000) / 60000)

    return send(res, {
      success: true,
      msg: 'Trip fetched successfully',
      data: { ...trip, duration: `${hours}h ${minutes}m` },
    })
  } catch (err) {
    return send(res, { success: false, msg: err.message, status: 500 })
  }
}
exports.getTripRoute = async (req, res) => {
  try {
    const { tripId } = req.params

    if (!mongoose.Types.ObjectId.isValid(tripId)) {
      return send(res, {
        success: false,
        msg: 'Valid trip ID required',
        status: 400,
      })
    }

    const trip = await Trip.findOne({ _id: tripId, deleted: false })
      .populate('fromStation toStation stops.station')
      .lean()

    if (!trip) {
      return send(res, { success: false, msg: 'Trip not found', status: 404 })
    }

    const route = [
      {
        type: 'start',
        name: trip.fromStation?.name,
        departureTime: trip.departureDate,
      },
      ...(trip.stops || []).map((s) => ({
        type: 'stop',
        name: s.station?.name,
        arrivalTime: s.arrivalTime,
        departureTime: s.departureTime,
      })),
      {
        type: 'end',
        name: trip.toStation?.name,
        arrivalTime: trip.arrivalDate,
      },
    ]

    return send(res, {
      success: true,
      msg: 'Trip route fetched',
      data: { tripId: trip._id, route },
    })
  } catch (err) {
    return send(res, { success: false, msg: err.message, status: 500 })
  }
}
exports.getAllTrips = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1)
    const limit = Math.min(parseInt(req.query.limit) || 10, 100)

    // فلترة الرحلات النشطة فقط
    const query = { deleted: false, status: 'scheduled' }

    const trips = await Trip.find(query)
      .sort({ departureDate: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()

    const count = await Trip.countDocuments(query)

    return send(res, {
      success: true,
      msg: 'Active trips fetched successfully',
      count,
      page,
      pages: Math.ceil(count / limit),
      data: trips,
    })
  } catch (err) {
    return send(res, { success: false, msg: err.message, status: 500 })
  }
}

exports.getTrainById = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return send(res, { success: false, msg: 'Invalid ID', status: 400 })
    }

    const train = await Train.findOne({
      _id: id,
      $or: [{ deleted: false }, { deleted: { $exists: false } }],
    }).lean()

    if (!train) {
      return send(res, { success: false, msg: 'Train not found', status: 404 })
    }

    return send(res, { success: true, msg: 'Train fetched', data: train })
  } catch (err) {
    return send(res, { success: false, msg: err.message, status: 500 })
  }
}
exports.getAllTrains = async (req, res) => {
  try {
    const filter = {
      $or: [{ deleted: false }, { deleted: { $exists: false } }],
    }

    const trains = await Train.find(filter).lean()
    const count = await Train.countDocuments(filter)

    return send(res, {
      success: true,
      msg: 'Trains fetched',
      count,
      data: trains,
    })
  } catch (err) {
    return send(res, { success: false, msg: err.message, status: 500 })
  }
}
exports.getAllStations = async (req, res) => {
  try {
    const filter = {
      status: 'active',
      $or: [{ deleted: false }, { deleted: { $exists: false } }],
    }

    const stations = await Station.find(filter).sort({ name: 1 }).lean()
    const count = await Station.countDocuments(filter)

    return send(res, {
      success: true,
      msg: 'Stations fetched',
      count,
      data: stations,
    })
  } catch (err) {
    return send(res, { success: false, msg: err.message, status: 500 })
  }
}
exports.getStationById = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return send(res, { success: false, msg: 'Invalid ID', status: 400 })
    }

    const station = await Station.findOne({
      _id: id,
      $or: [{ deleted: false }, { deleted: { $exists: false } }],
    }).lean()

    if (!station) {
      return send(res, {
        success: false,
        msg: 'Station not found',
        status: 404,
      })
    }

    return send(res, { success: true, msg: 'Station fetched', data: station })
  } catch (err) {
    return send(res, { success: false, msg: err.message, status: 500 })
  }
}
exports.getSeatsByTrainId = async (req, res) => {
  try {
    const { trainId } = req.params

    if (!mongoose.Types.ObjectId.isValid(trainId)) {
      return send(res, { success: false, msg: 'Invalid trainId', status: 400 })
    }

    const seats = await Seat.find({
      train: trainId,
      $or: [{ deleted: false }, { deleted: { $exists: false } }],
    })
      .populate('trip', 'fromStation toStation departureDate')
      .populate('reservedBy', '-password')
      .sort({ seatNumber: 1 })
      .lean()

    return send(res, {
      success: true,
      msg: 'Seats fetched',
      count: seats.length,
      data: seats,
    })
  } catch (err) {
    return send(res, { success: false, msg: err.message, status: 500 })
  }
}
exports.getSeatsByTripId = async (req, res) => {
  try {
    const { tripId } = req.params

    if (!tripId || !mongoose.Types.ObjectId.isValid(tripId)) {
      return send(res, {
        success: false,
        msg: 'Valid trip ID required',
        status: 400,
      })
    }

    const trip = await Trip.findOne({
      _id: tripId,
      deleted: false,
    }).lean()

    if (!trip) {
      return send(res, { success: false, msg: 'Trip not found', status: 404 })
    }

    // release expired locks (trip-specific)
    await Seat.updateMany(
      {
        trip: tripId,
        status: 'reserved',
        expireAt: { $lt: new Date() },
      },
      {
        $set: {
          status: 'available',
          reservedBy: null,
          expireAt: null,
        },
      }
    )

    const seats = await Seat.find({
      trip: tripId,
      $or: [{ deleted: false }, { deleted: { $exists: false } }],
    })
      .sort({ seatNumber: 1 })
      .lean()

    const groupedSeats = {
      VIP: [],
      First: [],
      Second: [],
    }

    let stats = {
      total: 0,
      available: 0,
      reserved: 0,
      booked: 0,
    }

    for (const s of seats) {
      stats.total++

      if (s.status === 'available') stats.available++
      if (s.status === 'reserved') stats.reserved++
      if (s.status === 'booked') stats.booked++

      if (groupedSeats[s.classType]) {
        groupedSeats[s.classType].push(s)
      }
    }

    return send(res, {
      success: true,
      msg: 'Seats fetched successfully',
      count: seats.length,
      stats,
      data: {
        tripId,
        groupedSeats,
      },
    })
  } catch (err) {
    return send(res, { success: false, msg: err.message, status: 500 })
  }
}
exports.getAllUsers = async (req, res) => {
  try {
    const page = Math.max(+req.query.page || 1, 1)
    const limit = Math.min(+req.query.limit || 10, 100)

    const filter = {
      $or: [{ deleted: false }, { deleted: { $exists: false } }],
    }

    const users = await User.find(filter)
      .select('-password -signupOtp -tempOtp')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean()

    const count = await User.countDocuments(filter)

    return send(res, {
      success: true,
      msg: 'Users fetched',
      count,
      page,
      pages: Math.ceil(count / limit),
      data: users,
    })
  } catch (err) {
    return send(res, { success: false, msg: err.message, status: 500 })
  }
}
exports.updateTrainById = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return send(res, { success: false, msg: 'Invalid ID', status: 400 })
    }

    delete req.body._id
    delete req.body.createdAt
    delete req.body.updatedAt
    delete req.body.deleted

    const train = await Train.findOneAndUpdate(
      {
        _id: id,
        $or: [{ deleted: false }, { deleted: { $exists: false } }],
      },
      {
        $set: req.body,
      },
      { new: true, runValidators: true }
    )

    if (!train) {
      return send(res, { success: false, msg: 'Train not found', status: 404 })
    }

    return send(res, { success: true, msg: 'Train updated', data: train })
  } catch (err) {
    return send(res, { success: false, msg: err.message, status: 500 })
  }
}
exports.updateStationById = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return send(res, { success: false, msg: 'Invalid ID', status: 400 })
    }

    delete req.body._id
    delete req.body.createdAt
    delete req.body.updatedAt
    delete req.body.deleted

    if (req.body.name) {
      req.body.name = req.body.name.trim()
    }

    const station = await Station.findOneAndUpdate(
      {
        _id: id,
        $or: [{ deleted: false }, { deleted: { $exists: false } }],
      },
      {
        $set: req.body,
      },
      { new: true, runValidators: true }
    )

    if (!station) {
      return send(res, {
        success: false,
        msg: 'Station not found',
        status: 404,
      })
    }

    return send(res, { success: true, msg: 'Station updated', data: station })
  } catch (err) {
    return send(res, { success: false, msg: err.message, status: 500 })
  }
}
exports.updateSeatById = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return send(res, { success: false, msg: 'Invalid seat ID', status: 400 })
    }

    delete req.body._id
    delete req.body.createdAt
    delete req.body.updatedAt
    delete req.body.trip
    delete req.body.reservedBy
    delete req.body.expireAt

    const existingSeat = await Seat.findById(id)

    if (!existingSeat) {
      return send(res, {
        success: false,
        msg: 'Seat not found',
        status: 404,
      })
    }

    if (existingSeat.status === 'booked') {
      return send(res, {
        success: false,
        msg: 'Cannot update booked seat',
        status: 400,
      })
    }

    const allowedStatuses = ['available', 'reserved', 'booked']

    if (req.body.status && !allowedStatuses.includes(req.body.status)) {
      return send(res, {
        success: false,
        msg: 'Invalid seat status',
        status: 400,
      })
    }

    const seat = await Seat.findByIdAndUpdate(
      id,
      { $set: req.body },
      { new: true, runValidators: true }
    )

    return send(res, {
      success: true,
      msg: 'Seat updated successfully',
      data: seat,
    })
  } catch (err) {
    return send(res, {
      success: false,
      msg: err.message,
      status: 500,
    })
  }
}
exports.updateTripById = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return send(res, {
        success: false,
        msg: 'Invalid trip ID',
        status: 400,
      })
    }

    delete req.body._id
    delete req.body.createdAt
    delete req.body.updatedAt
    delete req.body.deleted
    delete req.body.archived

    const existingTrip = await Trip.findById(id)

    if (!existingTrip || existingTrip.deleted) {
      return send(res, {
        success: false,
        msg: 'Trip not found',
        status: 404,
      })
    }

    if (existingTrip.status === 'completed') {
      return send(res, {
        success: false,
        msg: 'Cannot update completed trip',
        status: 400,
      })
    }

    const fromStation =
      req.body.fromStation || existingTrip.fromStation.toString()

    const toStation = req.body.toStation || existingTrip.toStation.toString()

    if (String(fromStation) === String(toStation)) {
      return send(res, {
        success: false,
        msg: 'From and To stations cannot be same',
        status: 400,
      })
    }

    const departureDate = req.body.departureDate || existingTrip.departureDate

    const arrivalDate = req.body.arrivalDate || existingTrip.arrivalDate

    if (new Date(arrivalDate) <= new Date(departureDate)) {
      return send(res, {
        success: false,
        msg: 'Arrival must be after departure',
        status: 400,
      })
    }

    if (new Date(departureDate) <= new Date()) {
      return send(res, {
        success: false,
        msg: 'Departure must be future',
        status: 400,
      })
    }

    const durationMinutes = Math.floor(
      (new Date(arrivalDate) - new Date(departureDate)) / 60000
    )

    req.body.duration = `${Math.floor(durationMinutes / 60)}h ${durationMinutes % 60}m`

    const trip = await Trip.findByIdAndUpdate(
      id,
      { $set: req.body },
      {
        new: true,
        runValidators: true,
      }
    )
      .populate('train', 'name number type')
      .populate('fromStation', 'name displayName')
      .populate('toStation', 'name displayName')
      .populate('stops.station', 'name displayName')

    return send(res, {
      success: true,
      msg: 'Trip updated successfully',
      data: trip,
    })
  } catch (err) {
    return send(res, {
      success: false,
      msg: err.message,
      status: 500,
    })
  }
}
exports.deleteAllTrains = async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return send(res, {
        success: false,
        msg: 'Not allowed in production',
        status: 403,
      })
    }

    await Promise.all([
      Train.updateMany({}, { $set: { deleted: true } }),
      Trip.updateMany({}, { $set: { deleted: true } }),
      Seat.updateMany({}, { $set: { deleted: true } }),
      Booking.updateMany({}, { $set: { deleted: true } }),
    ])

    return send(res, {
      success: true,
      msg: 'All trains, trips, seats and bookings soft-deleted successfully',
    })
  } catch (err) {
    return send(res, {
      success: false,
      msg: err.message,
      status: 500,
    })
  }
}
exports.deleteTrainById = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return send(res, {
        success: false,
        msg: 'Invalid ID',
        status: 400,
      })
    }

    const train = await Train.findById(id)

    if (!train) {
      return send(res, {
        success: false,
        msg: 'Train not found',
        status: 404,
      })
    }

    const hasTrips = await Trip.exists({ train: id })

    if (hasTrips) {
      return send(res, {
        success: false,
        msg: 'Cannot delete train used in trips',
        status: 400,
      })
    }

    train.deleted = true
    await train.save()

    return send(res, {
      success: true,
      msg: 'Train soft-deleted successfully',
    })
  } catch (err) {
    return send(res, {
      success: false,
      msg: err.message,
      status: 500,
    })
  }
}
exports.deleteStationById = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return send(res, {
        success: false,
        msg: 'Invalid ID',
        status: 400,
      })
    }

    const used = await Trip.exists({
      $or: [{ fromStation: id }, { toStation: id }],
    })

    if (used) {
      return send(res, {
        success: false,
        msg: 'Cannot delete station used in trips',
        status: 400,
      })
    }

    const station = await Station.findById(id)

    if (!station) {
      return send(res, {
        success: false,
        msg: 'Station not found',
        status: 404,
      })
    }

    station.deleted = true
    await station.save()

    return send(res, {
      success: true,
      msg: 'Station soft-deleted successfully',
    })
  } catch (err) {
    return send(res, {
      success: false,
      msg: err.message,
      status: 500,
    })
  }
}
exports.deleteAllStations = async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return send(res, {
        success: false,
        msg: 'Not allowed in production',
        status: 403,
      })
    }

    const used = await Trip.exists({})

    if (used) {
      return send(res, {
        success: false,
        msg: 'Cannot delete stations while trips exist',
        status: 400,
      })
    }

    await Station.updateMany({}, { $set: { deleted: true } })

    return send(res, {
      success: true,
      msg: 'All stations soft-deleted successfully',
    })
  } catch (err) {
    return send(res, {
      success: false,
      msg: err.message,
      status: 500,
    })
  }
}
exports.deleteSeatById = async (req, res) => {
  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return send(res, {
        success: false,
        msg: 'Invalid seat ID',
        status: 400,
      })
    }

    const seat = await Seat.findOne({
      _id: id,
      deleted: false,
    })

    if (!seat) {
      return send(res, {
        success: false,
        msg: 'Seat not found',
        status: 404,
      })
    }

    if (['locked', 'booked'].includes(seat.status)) {
      return send(res, {
        success: false,
        msg: 'Cannot delete locked or booked seat',
        status: 400,
      })
    }

    const hasBooking = await Booking.exists({
      seats: seat._id,
      deleted: false,
    })

    if (hasBooking) {
      return send(res, {
        success: false,
        msg: 'Cannot delete seat with booking history',
        status: 400,
      })
    }

    seat.deleted = true
    await seat.save()

    return send(res, {
      success: true,
      msg: 'Seat soft-deleted successfully',
    })
  } catch (err) {
    return send(res, {
      success: false,
      msg: err.message,
      status: 500,
    })
  }
}
exports.deleteTrip = async (req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    const { id } = req.params

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid trip ID')
    }

    const trip = await Trip.findOne({
      _id: id,
      deleted: false,
    }).session(session)

    if (!trip) {
      throw new Error('Trip not found')
    }

    if (trip.status === 'completed') {
      throw new Error('Cannot delete completed trip')
    }

    const hasBookings = await Booking.exists({
      trip: trip._id,
      deleted: false,
    }).session(session)

    if (hasBookings) {
      throw new Error('Cannot delete trip with bookings')
    }

    await Seat.updateMany(
      { trip: trip._id },
      { $set: { deleted: true } },
      { session }
    )

    trip.deleted = true
    await trip.save({ session })

    await session.commitTransaction()
    session.endSession()

    return send(res, {
      success: true,
      msg: 'Trip soft-deleted successfully',
    })
  } catch (err) {
    await session.abortTransaction()
    session.endSession()

    return send(res, {
      success: false,
      msg: err.message,
      status: 400,
    })
  }
}
exports.deleteAllTrips = async (req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('Forbidden in production')
    }

    await Promise.all([
      Trip.updateMany(
        { deleted: false },
        { $set: { deleted: true } },
        { session }
      ),

      Seat.updateMany(
        { deleted: false },
        { $set: { deleted: true } },
        { session }
      ),

      Booking.updateMany(
        { deleted: false },
        { $set: { deleted: true } },
        { session }
      ),
    ])

    await session.commitTransaction()
    session.endSession()

    return send(res, {
      success: true,
      msg: 'All trips, seats and bookings soft-deleted successfully',
    })
  } catch (err) {
    await session.abortTransaction()
    session.endSession()

    return send(res, {
      success: false,
      msg: err.message,
      status: 500,
    })
  }
}
exports.deleteUserById = async (req, res) => {
  try {
    const { id } = req.params

    if (!id || !mongoose.Types.ObjectId.isValid(id)) {
      return send(res, {
        success: false,
        msg: 'Invalid user ID',
        status: 400,
      })
    }

    const user = await User.findById(id)

    if (!user) {
      return send(res, {
        success: false,
        msg: 'User not found',
        status: 404,
      })
    }

    const hasBookings = await Booking.exists({ user: id })

    if (hasBookings) {
      return send(res, {
        success: false,
        msg: 'Cannot delete user with bookings',
        status: 400,
      })
    }

    await User.findByIdAndDelete(id)

    return send(res, {
      success: true,
      msg: 'User deleted successfully',
      data: user,
    })
  } catch (err) {
    return send(res, {
      success: false,
      msg: err.message,
      status: 500,
    })
  }
}
exports.databaseFreeUp = async (req, res) => {
  try {
    if (process.env.NODE_ENV === 'production') {
      return send(res, {
        success: false,
        msg: 'Forbidden in production',
        status: 403,
      })
    }

    await Promise.all([
      Booking.updateMany({}, { $set: { deleted: true } }),
      Seat.updateMany({}, { $set: { deleted: true } }),
      Trip.updateMany({}, { $set: { deleted: true } }),
      Train.updateMany({}, { $set: { deleted: true } }),
      Station.updateMany({}, { $set: { deleted: true } }),

      User.deleteMany({ role: { $ne: 'Admin' } }),
    ])

    return send(res, {
      success: true,
      msg: 'Database soft-cleared successfully',
    })
  } catch (err) {
    return send(res, {
      success: false,
      msg: err.message,
      status: 500,
    })
  }
}
//----------------------
//! ADMIN METHODS (25)
//----------------------
//? CREATE
//? createStations
//? createStation
//? createTrains
//? createTrain
//? createTrips
//? createTrip
//? createSeats
//? createSeat
//? getAllTrains
//? getTrainById
//? getAllTrips
//? getTripById
//? getAllStations
//? getStationById
//? getAllUsers
//? getSeatsByTrainId
//? getSeatsByTripId
//? updateTripById
//? updateTrainById
//? updateStationById
//? updateSeatById
//? deleteTrip
//? deleteTrainById
//? deleteStationById
//? deleteSeatById
//? deleteAllTrips
//? deleteAllTrains
//? deleteAllStations
//? deleteAllSeats
//? databaseFreeUp
//---------------------
