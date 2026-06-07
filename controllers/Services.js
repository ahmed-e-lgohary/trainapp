const Station = require('../models/Station')
const Trip = require('../models/Trip')
const Seat = require('../models/Seat')
const Booking = require('../models/Booking')
const {
  sendBookedTicketEmail,
  sendHoldTicketEmail,
} = require('../services/emailService')
const QRCode = require('qrcode')
const mongoose = require('mongoose')
const jwt = require('jsonwebtoken')
const axios = require('axios')
const User = require('../models/User') // ✅ adjust path if needed
const sendRes = (
  res,
  { success = true, msg = '', data = null, status = 200 }
) => {
  return res.status(status).json({
    success,
    msg,
    data,
  })
}
// Helper to generate seats with specific layouts (2+1 for VIP/First, 2+2 for Second)
const generateSeatsForTrip = async (trainDoc, tripId, basePrice) => {
  if (!tripId || !trainDoc) return [];

  const seats = [];
  let seatNumber = 1;

  // 1. VIP Class (2+1 Layout): Window, Aisle, Window | Window, Aisle, Window | ...
  const vipCount = trainDoc.classes?.VIP || 0;
  for (let i = 0; i < vipCount; i++) {
    const posInGroup = i % 3; // 0=Window, 1=Aisle, 2=Window
    const seatType = posInGroup === 1 ? 'Aisle' : 'Window';
    seats.push({
      trip: tripId,
      train: trainDoc._id,
      seatNumber: seatNumber++,
      classType: 'VIP',
      seatType,
      price: Math.round(basePrice * 1.5),
      status: 'available',
      deleted: false,
    });
  }

  // 2. First Class (2+1 Layout): Window, Aisle, Window | Window, Aisle, Window | ...
  const firstCount = trainDoc.classes?.First || 0;
  for (let i = 0; i < firstCount; i++) {
    const posInGroup = i % 3; // 0=Window, 1=Aisle, 2=Window
    const seatType = posInGroup === 1 ? 'Aisle' : 'Window';
    seats.push({
      trip: tripId,
      train: trainDoc._id,
      seatNumber: seatNumber++,
      classType: 'First',
      seatType,
      price: Math.round(basePrice * 1.2),
      status: 'available',
      deleted: false,
    });
  }

  // 3. Second Class (2+2 Layout): Window, Aisle, Aisle, Window | Window, Aisle, Aisle, Window | ...
  const secondCount = trainDoc.classes?.Second || 0;
  for (let i = 0; i < secondCount; i++) {
    const posInGroup = i % 4; // 0=Window, 1=Aisle, 2=Aisle, 3=Window
    const seatType = (posInGroup === 0 || posInGroup === 3) ? 'Window' : 'Aisle';
    seats.push({
      trip: tripId,
      train: trainDoc._id,
      seatNumber: seatNumber++,
      classType: 'Second',
      seatType,
      price: basePrice,
      status: 'available',
      deleted: false,
    });
  }

  if (seats.length > 0) {
    await Seat.insertMany(seats);
  }
  return seats;
};

// Helper to ensure trips and seats exist for a given date by copying from reference/template trips
const ensureTripsExistForDate = async (targetDateStr) => {
  const targetDate = new Date(targetDateStr);
  
  const startDate = new Date(targetDate);
  startDate.setHours(0, 0, 0, 0);
  
  const endDate = new Date(targetDate);
  endDate.setHours(23, 59, 59, 999);
  
  // Check if we have the full schedule of trips for this day (at least 10 trips)
  const existingCount = await Trip.countDocuments({
    departureDate: { $gte: startDate, $lte: endDate },
    deleted: false,
  });
  
  if (existingCount >= 30) {
    return;
  }
  
  console.log(`⚙️ Incomplete or no trips found for date ${targetDateStr} (${existingCount} found). Regenerating schedule...`);
  
  // Clean up any old partial trips and their seats for this day to avoid duplicates
  const tripsToDelete = await Trip.find({
    departureDate: { $gte: startDate, $lte: endDate }
  }, '_id');
  
  if (tripsToDelete.length > 0) {
    const tripIds = tripsToDelete.map(t => t._id);
    await Seat.deleteMany({ trip: { $in: tripIds } });
    await Trip.deleteMany({ _id: { $in: tripIds } });
    console.log(`🧹 Cleaned up ${tripsToDelete.length} partial trips and their seats for ${targetDateStr}.`);
  }

  // Find a reference day that has the most trips (to guarantee we get the full 16-trip template)
  const allTrips = await Trip.find({ deleted: false }, 'departureDate').lean();
  const dateCounts = {};
  allTrips.forEach(t => {
    const dStr = new Date(t.departureDate).toISOString().split('T')[0];
    dateCounts[dStr] = (dateCounts[dStr] || 0) + 1;
  });

  let refDateStr = null;
  let maxCount = 0;
  for (const dStr in dateCounts) {
    if (dateCounts[dStr] > maxCount) {
      maxCount = dateCounts[dStr];
      refDateStr = dStr;
    }
  }

  if (!refDateStr || maxCount === 0) {
    console.log("⚠️ No reference trips in database to clone from.");
    return;
  }
  
  // Find all trips on the reference day
  const refStartDate = new Date(refDateStr);
  refStartDate.setHours(0, 0, 0, 0);
  const refEndDate = new Date(refDateStr);
  refEndDate.setHours(23, 59, 59, 999);
  
  const refTrips = await Trip.find({
    departureDate: { $gte: refStartDate, $lte: refEndDate },
    deleted: false,
  }).populate('train');
  
  console.log(`📋 Found ${refTrips.length} template trips on reference date ${refDateStr}`);
  
  for (const trip of refTrips) {
    const newDep = new Date(targetDate);
    newDep.setHours(trip.departureDate.getHours(), trip.departureDate.getMinutes(), 0, 0);
    
    const durationMs = trip.arrivalDate.getTime() - trip.departureDate.getTime();
    const newArr = new Date(newDep.getTime() + durationMs);
    
    // Shift stops times
    const timeDiff = newDep.getTime() - trip.departureDate.getTime();
    const newStops = (trip.stops || []).map(s => ({
      station: s.station,
      arrivalTime: s.arrivalTime ? new Date(new Date(s.arrivalTime).getTime() + timeDiff) : undefined,
      departureTime: s.departureTime ? new Date(new Date(s.departureTime).getTime() + timeDiff) : undefined,
      order: s.order,
    }));
    
    // Create new trip
    const [createdTrip] = await Trip.create([{
      route: trip.route || new mongoose.Types.ObjectId(),
      train: trip.train._id,
      fromStation: trip.fromStation,
      toStation: trip.toStation,
      fromIndex: trip.fromIndex !== undefined ? trip.fromIndex : 0,
      toIndex: trip.toIndex !== undefined ? trip.toIndex : 1,
      departureDate: newDep,
      arrivalDate: newArr,
      durationMinutes: trip.durationMinutes,
      price: trip.price,
      stops: newStops,
      status: 'scheduled',
      deleted: false,
    }]);
    
    // Generate seats for the new trip
    if (trip.train) {
      await generateSeatsForTrip(trip.train, createdTrip._id, trip.price);
    }
  }
  
  console.log(`🎉 Successfully generated ${refTrips.length} trips and seats for date ${targetDateStr}`);
};

const governorateToStationName = {
  "cairo": "Cairo Central Station",
  "alexandria": "Alexandria Main Station",
  "gharbia": "Tanta Station",
  "qalyubia": "Banha Station",
  "giza": "Giza Station",
  "minya": "Minya Station",
  "sohag": "Sohag Station",
  "luxor": "Luxor Station",
  "aswan": "Aswan Station",
  "port said": "Port Said Station",
  "ismailia": "Ismailia Station",
  "sharqia": "Zagazig Station",
  "qena": "Qena Station",
  "fayoum": "Fayoum Station",
  "faiyum": "Fayoum Station",
  "beni suef": "Beni Suef Station",
  "asyut": "Asyut Station",
  "suez": "Suez Station",
  "dakahlia": "Mansoura Station",
  "beheira": "Damanhur Station",
  "kafr el sheikh": "Kafr El Sheikh Station",
  "damietta": "Damietta Station",
  "monufia": "Shebin El Kom Station",
  "matrouh": "Matrouh Station",
  "new valley": "Kharga Station",
  "north sinai": "El Arish Station",
  "south sinai": "Sharm El Sheikh Station",
  "red sea": "Hurghada Station"
};

const stationNameToGovernorate = {
  "Cairo Central Station": "Cairo",
  "Alexandria Main Station": "Alexandria",
  "Tanta Station": "Gharbia",
  "Banha Station": "Qalyubia",
  "Giza Station": "Giza",
  "Minya Station": "Minya",
  "Sohag Station": "Sohag",
  "Luxor Station": "Luxor",
  "Aswan Station": "Aswan",
  "Port Said Station": "Port Said",
  "Ismailia Station": "Ismailia",
  "Zagazig Station": "Sharqia",
  "Qena Station": "Qena",
  "Fayoum Station": "Faiyum",
  "Beni Suef Station": "Beni Suef",
  "Asyut Station": "Asyut",
  "Suez Station": "Suez",
  "Mansoura Station": "Dakahlia",
  "Damanhur Station": "Beheira",
  "Kafr El Sheikh Station": "Kafr El Sheikh",
  "Damietta Station": "Damietta",
  "Shebin El Kom Station": "Monufia",
  "Matrouh Station": "Matrouh",
  "Kharga Station": "New Valley",
  "El Arish Station": "North Sinai",
  "Sharm El Sheikh Station": "South Sinai",
  "Hurghada Station": "Red Sea"
};

const arabicToEnglishMap = {
  "القاهره": "cairo",
  "الاسكندريه": "alexandria",
  "الجيزه": "giza",
  "طنطا": "tanta",
  "الغربيه": "tanta",
  "بنها": "banha",
  "القليوبيه": "banha",
  "المنيا": "minya",
  "سوهاج": "sohag",
  "الاقصر": "luxor",
  "اسوان": "aswan",
  "بورسعيد": "port said",
  "بور سعيد": "port said",
  "الاسماعيليه": "ismailia",
  "الزقازيق": "zagazig",
  "الشرقيه": "zagazig",
  "قنا": "qena",
  "الفيوم": "fayoum",
  "بني سويف": "beni suef",
  "بنى سويف": "beni suef",
  "اسيوط": "asyut",
  "السويس": "suez",
  "المنصوره": "mansoura",
  "الدقهليه": "mansoura",
  "دمنهور": "damanhur",
  "البحيره": "damanhur",
  "كفر الشيخ": "kafr el sheikh",
  "كفرالشيخ": "kafr el sheikh",
  "دمياط": "damietta",
  "شبين الكوم": "shebin el kom",
  "المنوفيه": "shebin el kom",
  "مطروح": "matrouh",
  "مرسي مطروح": "matrouh",
  "الوادي الجديد": "kharga",
  "الخارجه": "kharga",
  "العريش": "el arish",
  "شمال سيناء": "el arish",
  "شرم الشيخ": "sharm el sheikh",
  "جنوب سيناء": "sharm el sheikh",
  "الغردقه": "hurghada",
  "البحر الاحمر": "hurghada"
};

const normalizeArabic = (str) => {
  if (!str) return "";
  return str
    .toString()
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
};

const resolveStationId = async (stationIdOrName) => {
  if (!stationIdOrName) return null;
  let idStr = stationIdOrName.toString().trim();
  if (mongoose.Types.ObjectId.isValid(idStr)) {
    return idStr;
  }
  
  // Try Arabic name resolution
  const normalizedArabicInput = normalizeArabic(idStr.toLowerCase());
  if (arabicToEnglishMap[normalizedArabicInput]) {
    idStr = arabicToEnglishMap[normalizedArabicInput];
  }
  
  const mappedName = governorateToStationName[idStr.toLowerCase()];
  if (mappedName) {
    idStr = mappedName;
  }

  const escaped = idStr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  let stationDoc = await Station.findOne({
    $or: [
      { name: new RegExp('^' + escaped + '$', 'i') },
      { displayName: new RegExp('^' + escaped + '$', 'i') },
      { normalizedName: idStr.toLowerCase().trim() }
    ]
  });
  if (!stationDoc) {
    stationDoc = await Station.findOne({
      $or: [
        { name: new RegExp(escaped, 'i') },
        { displayName: new RegExp(escaped, 'i') }
      ]
    });
  }
  return stationDoc ? stationDoc._id.toString() : null;
};

const getNormalizedStops = (stops, departureDate) => {
  return stops || [];
};

// Helper to determine the station order along a trip route
const getStationOrder = (trip, stationIdStr) => {
  if (!stationIdStr) return -1;
  const sIdStr = stationIdStr.toString();
  const tripFromId = trip.fromStation?._id ? trip.fromStation._id.toString() : trip.fromStation?.toString();
  if (tripFromId === sIdStr) return 0;
  
  const stops = trip.stops || [];
  const stopIndex = stops.findIndex(s => {
    const sId = s.station?._id ? s.station._id.toString() : s.station?.toString();
    return sId === sIdStr;
  });
  if (stopIndex !== -1) return stopIndex + 1;
  
  const tripToId = trip.toStation?._id ? trip.toStation._id.toString() : trip.toStation?.toString();
  if (tripToId === sIdStr) return stops.length + 1;
  return -1;
};

// Helper to calculate seat price dynamically based on trip segments and Talgo constraints
const calculateDynamicSeatPrice = (trip, fromStationId, toStationId, seat) => {
  const trainType = trip.train?.type;
  
  if (trainType === 'Talgo') {
    const getStationGovName = (stationId) => {
      if (!stationId) return "";
      const sId = stationId.toString();
      if (trip.fromStation?._id?.toString() === sId) {
        return (stationNameToGovernorate[trip.fromStation.name] || "").toLowerCase();
      }
      if (trip.toStation?._id?.toString() === sId) {
        return (stationNameToGovernorate[trip.toStation.name] || "").toLowerCase();
      }
      const stop = (trip.stops || []).find(s => (s.station?._id || s.station).toString() === sId);
      if (stop && stop.station) {
        return (stationNameToGovernorate[stop.station.name] || "").toLowerCase();
      }
      return "";
    };

    const fromSegmentGov = getStationGovName(fromStationId);
    const toSegmentGov = getStationGovName(toStationId);

    if (fromSegmentGov === 'cairo' || toSegmentGov === 'cairo') {
      const otherGov = fromSegmentGov === 'cairo' ? toSegmentGov : fromSegmentGov;
      const isFirst = seat.classType === 'First' || seat.classType === 'VIP';
      
      switch (otherGov) {
        case 'asyut':
          return isFirst ? 350 : 250;
        case 'sohag':
          return isFirst ? 500 : 300;
        case 'qena':
          return isFirst ? 550 : 350;
        case 'luxor':
          return isFirst ? 600 : 400;
        case 'aswan':
          return isFirst ? 700 : 550;
        default:
          break;
      }
    }
  }

  // Fallback: Proportional pricing
  const fromOrder = getStationOrder(trip, fromStationId);
  const toOrder = getStationOrder(trip, toStationId);
  const totalSegments = (trip.stops || []).length + 1;
  const travelledSegments = (fromOrder >= 0 && toOrder >= 0 && fromOrder < toOrder) ? (toOrder - fromOrder) : totalSegments;
  
  return Math.round(seat.price * travelledSegments / totalSegments);
};

// البحث عن الرحلات من يوم حتى 30 يوم بعده (مع دعم محطات التوقف وتوليد الرحلات تلقائياً)
exports.searchTrips = async (req, res) => {
  try {
    const { from, to, date } = req.query

    if (!from || !to || !date) {
      return res
        .status(400)
        .json({ success: false, msg: 'from, to, and date are required' })
    }

    const fromStationId = await resolveStationId(from);
    const toStationId = await resolveStationId(to);

    if (!fromStationId || !toStationId) {
      return res.status(400).json({ success: false, msg: 'Invalid from or to station' })
    }

    // 18-day advance booking constraint
    const selectedDate = new Date(date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    selectedDate.setHours(0, 0, 0, 0);

    const diffTime = selectedDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 18) {
      return res.status(400).json({
        success: false,
        msg: 'عفواً، لا يمكن حجز رحلات لأكثر من 18 يوماً مقدماً.'
      });
    }

    if (diffDays < 0) {
      return res.status(400).json({
        success: false,
        msg: 'عفواً، لا يمكن حجز رحلات في الماضي.'
      });
    }

    // 1. تأكيد وجود الرحلات وتوليدها تلقائياً إذا لم تكن موجودة
    await ensureTripsExistForDate(date);

    // بداية ونهاية اليوم
    const startDate = new Date(date)
    startDate.setHours(0, 0, 0, 0)

    const endDate = new Date(date)
    endDate.setHours(23, 59, 59, 999)

    // 2. البحث عن الرحلات التي تحتوي على محطة الصعود ومحطة الهبوط في خط سيرها
    let query = {
      departureDate: { $gte: startDate, $lte: endDate },
      deleted: false,
      status: 'scheduled',
      $and: [
        { $or: [{ fromStation: fromStationId }, { 'stops.station': fromStationId }] },
        { $or: [{ toStation: toStationId }, { 'stops.station': toStationId }] }
      ]
    };

    let trips = await Trip.find(query)
      .populate('train fromStation toStation stops.station')
      .sort({ departureDate: 1 })
      .lean()

    // Fallback: If no trips found for this specific date, search without the date constraint
    if (!trips || trips.length === 0) {
      console.log(`🔍 Fallback: No trips found on ${date}. Searching regardless of date...`);
      query = {
        deleted: false,
        status: 'scheduled',
        $and: [
          { $or: [{ fromStation: fromStationId }, { 'stops.station': fromStationId }] },
          { $or: [{ toStation: toStationId }, { 'stops.station': toStationId }] }
        ]
      };
      trips = await Trip.find(query)
        .populate('train fromStation toStation stops.station')
        .sort({ departureDate: 1 })
        .lean();

      // Deduplicate trips to show only unique train schedules
      const seen = new Set();
      const uniqueTrips = [];
      for (const t of trips) {
        if (!t.train) continue;
        const key = `${t.train.number}-${t.departureDate.getHours()}:${t.departureDate.getMinutes()}`;
        if (!seen.has(key)) {
          seen.add(key);
          uniqueTrips.push(t);
        }
      }
      trips = uniqueTrips;
    }

    // 3. فلترة الرحلات وتعديل المواعيد والأسعار بالنسبة للمسار الجزئي المختار
    const formattedTrips = [];
    for (const trip of trips) {
      trip.stops = getNormalizedStops(trip.stops, trip.departureDate);
      const fromOrder = getStationOrder(trip, fromStationId);
      const toOrder = getStationOrder(trip, toStationId);

      if (fromOrder >= 0 && toOrder >= 0 && fromOrder < toOrder) {
        // حساب مواعيد المغادرة والوصول الفعليين للقسم المختار من الرحلة
        let displayDeparture = trip.departureDate;
        let displayArrival = trip.arrivalDate;

        if (fromOrder > 0) {
          displayDeparture = trip.stops[fromOrder - 1].departureTime;
        }

        if (toOrder < (trip.stops || []).length + 1) {
          displayArrival = trip.stops[toOrder - 1].arrivalTime;
        }

        const displayDuration = Math.round((new Date(displayArrival) - new Date(displayDeparture)) / (1000 * 60));

        const totalSegments = (trip.stops || []).length + 1;
        const travelledSegments = toOrder - fromOrder;

        const getGovOrDisplayName = (station) => {
          return stationNameToGovernorate[station.name] || station.displayName || station.name;
        };

        const displayFrom = fromOrder === 0 ? getGovOrDisplayName(trip.fromStation) : getGovOrDisplayName(trip.stops[fromOrder - 1].station);
        const displayTo = toOrder === totalSegments ? getGovOrDisplayName(trip.toStation) : getGovOrDisplayName(trip.stops[toOrder - 1].station);

        // حساب السعر التناسبي بناءً على عدد المحطات المقطوعة
        let displayPrice = Math.round(trip.price * travelledSegments / totalSegments);

        if (trip.train?.type === 'Talgo') {
          const fromGov = displayFrom.toLowerCase();
          const toGov = displayTo.toLowerCase();
          if (fromGov === 'cairo' || toGov === 'cairo') {
            const otherGov = fromGov === 'cairo' ? toGov : fromGov;
            switch (otherGov) {
              case 'asyut': displayPrice = 250; break;
              case 'sohag': displayPrice = 300; break;
              case 'qena': displayPrice = 350; break;
              case 'luxor': displayPrice = 400; break;
              case 'aswan': displayPrice = 550; break;
            }
          }
        }

        // حساب عدد الكراسي المتاحة في هذا القطاع المحدد
        const seats = await Seat.find({ trip: trip._id, deleted: false }).lean();
        const activeBookings = await Booking.find({
          trip: trip._id,
          status: { $in: ['active', 'cancelling'] },
          paymentStatus: { $in: ['paid', 'pending'] },
          deleted: { $ne: true }
        }).lean();

        const occupiedSeatIds = new Set();
        for (const b of activeBookings) {
          if (b.bookingSegments && b.bookingSegments.length > 0) {
            for (const seg of b.bookingSegments) {
              if (!seg.seat) continue;
              const segFrom = seg.fromIndex !== undefined ? seg.fromIndex : 0;
              const segTo = seg.toIndex !== undefined ? seg.toIndex : totalSegments;
              const overlap = segFrom < toOrder && segTo > fromOrder;
              if (overlap) {
                occupiedSeatIds.add(seg.seat.toString());
              }
            }
          } else {
            // Legacy/fallback fallback
            const seatIds = b.seats || (b.passengers || []).map(p => p.seatId).filter(Boolean);
            for (const sId of seatIds) {
              occupiedSeatIds.add(sId.toString());
            }
          }
        }

        const availableTickets = seats.filter(s => !occupiedSeatIds.has(s._id.toString())).length;

        // تهيئة الكائن ليتوافق مع تطبيق Flutter (flat structure) ومع الـ DB Viewer في آن واحد
        formattedTrips.push({
          ...trip,
          tripId: trip._id.toString(),
          trainNumber: trip.train.number,
          trainType: trip.train.type,
          from: displayFrom,
          to: displayTo,
          departureTime: new Date(displayDeparture).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          arrivalTime: new Date(displayArrival).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true }),
          duration: `${displayDuration} mins`,
          price: displayPrice,
          availableTickets,
          totalSeats: seats.length,
          display: {
            departureDate: displayDeparture,
            arrivalDate: displayArrival,
            durationMinutes: displayDuration,
            price: displayPrice,
            fromStationName: displayFrom,
            toStationName: displayTo,
          }
        });
      }
    }

    if (formattedTrips.length === 0) {
      return res.json({ success: false, msg: 'No trips found for this path and date' })
    }

    return res.json({
      success: true,
      msg: 'Trips fetched successfully',
      count: formattedTrips.length,
      data: formattedTrips,
    })
  } catch (err) {
    return res.status(500).json({ success: false, msg: err.message })
  }
}
exports.getTripStops = async (req, res) => {
  try {
    const { tripId } = req.params
    const { departureDate } = req.query // التاريخ من query string

    if (!mongoose.Types.ObjectId.isValid(tripId)) {
      return res.status(400).json({
        success: false,
        msg: 'Invalid trip ID',
        data: null,
      })
    }

    // بناء الشرط
    const query = { _id: tripId, deleted: false, archived: false }
    if (departureDate) query.departureDate = new Date(departureDate)

    // جلب الرحلة
    const trip = await Trip.findOne(query)
      .populate('fromStation', 'name displayName')
      .populate('toStation', 'name displayName')
      .populate('train', 'name number type averageSpeed deleted')
      .lean()

    if (!trip) {
      return res.status(404).json({
        success: false,
        msg: 'Trip not found',
        data: null,
      })
    }

    // استخدم stops لو موجودة، وإلا routeStops
    const rawStops = trip.stops?.length ? trip.stops : trip.routeStops || [];
    const stops = getNormalizedStops(rawStops, trip.departureDate);

    return res.status(200).json({
      success: true,
      msg: 'Stops fetched successfully',
      data: {
        tripId: trip._id,
        departureDate: trip.departureDate,
        arrivalDate: trip.arrivalDate,
        stopsCount: stops.length,
        stops: stops.map((s) => ({
          stationId: s.station?._id || s.station,
          stationName: s.station?.displayName || s.station?.name || undefined,
          arrivalTime: s.arrivalTime,
          departureTime: s.departureTime,
        })),
      },
    })
  } catch (err) {
    return res.status(500).json({
      success: false,
      msg: err.message,
      data: null,
    })
  }
}

exports.getAllStations = async (req, res) => {
  try {
    const { status, country } = req.query

    const filter = {
      deleted: false,
    }

    if (status) {
      filter.status = status
    }

    if (country) {
      filter.country = country
    }

    // Only get stations that actually have scheduled non-deleted trips
    const trips = await Trip.find({ deleted: false, status: 'scheduled' }, 'fromStation toStation stops.station').lean()
    const activeStationIds = new Set()
    for (const trip of trips) {
      if (trip.fromStation) activeStationIds.add(trip.fromStation.toString())
      if (trip.toStation) activeStationIds.add(trip.toStation.toString())
      if (trip.stops) {
        for (const stop of trip.stops) {
          if (stop.station) activeStationIds.add(stop.station.toString())
        }
      }
    }
    filter._id = { $in: Array.from(activeStationIds).map(id => new mongoose.Types.ObjectId(id)) }

    const stations = await Station.find(filter)
      .sort({ priority: -1, name: 1 })
      .lean()

    const uniqueGovernorates = new Map();
    for (const s of stations) {
      const gov = stationNameToGovernorate[s.name];
      if (gov && !uniqueGovernorates.has(gov)) {
        uniqueGovernorates.set(gov, {
          _id: s._id,
          name: s.name,
          displayName: gov
        });
      }
    }

    const result = Array.from(uniqueGovernorates.values());
    result.sort((a, b) => a.displayName.localeCompare(b.displayName));

    return res.json({
      success: true,
      msg: 'Stations fetched successfully',
      count: result.length,
      data: result,
    })
  } catch (err) {
    return res.status(500).json({
      success: false,
      msg: err.message,
    })
  }
}
exports.getSeatsByTrip = async (req, res) => {
  try {
    const tripId = req.params.tripId || req.query.tripId;
    const { date, from, to } = req.query;

    if (!tripId || !mongoose.Types.ObjectId.isValid(tripId)) {
      return res.status(400).json({ success: false, msg: 'Invalid or missing trip ID' })
    }

    const query = { _id: tripId, deleted: false };
    if (date) {
      const startDate = new Date(date)
      const endDate = new Date(startDate)
      endDate.setDate(startDate.getDate() + 1)
      query.departureDate = { $gte: startDate, $lt: endDate };
    }

    const trip = await Trip.findOne(query).populate('train fromStation toStation stops.station');

    if (!trip) {
      return res
        .status(404)
        .json({ success: false, msg: 'Trip not found' })
    }

    // Resolve boarding and destination stations
    let fromStationId = from ? await resolveStationId(from) : null;
    let toStationId = to ? await resolveStationId(to) : null;

    if (!fromStationId) fromStationId = trip.fromStation._id.toString();
    if (!toStationId) toStationId = trip.toStation._id.toString();

    const fromOrder = getStationOrder(trip, fromStationId);
    const toOrder = getStationOrder(trip, toStationId);
    const totalSegments = (trip.stops || []).length + 1;

    // Load seats
    const seats = await Seat.find({ trip: trip._id, deleted: false }).lean();

    // Load active bookings
    const activeBookings = await Booking.find({
      trip: trip._id,
      status: { $in: ['active', 'cancelling'] },
      paymentStatus: { $in: ['paid', 'pending'] },
      deleted: { $ne: true }
    }).lean();

    const reservedSeatIds = new Set();
    const bookedSeatIds = new Set();

    for (const b of activeBookings) {
      if (b.bookingSegments && b.bookingSegments.length > 0) {
        for (const seg of b.bookingSegments) {
          if (!seg.seat) continue;
          const segFrom = seg.fromIndex !== undefined ? seg.fromIndex : 0;
          const segTo = seg.toIndex !== undefined ? seg.toIndex : totalSegments;
          const overlap = segFrom < toOrder && segTo > fromOrder;
          if (overlap) {
            if (b.paymentStatus === 'paid') {
              bookedSeatIds.add(seg.seat.toString());
            } else {
              reservedSeatIds.add(seg.seat.toString());
            }
          }
        }
      } else {
        // Legacy booking (entire route)
        const seatIds = b.seats || (b.passengers || []).map(p => p.seatId).filter(Boolean);
        for (const sId of seatIds) {
          if (b.paymentStatus === 'paid') {
            bookedSeatIds.add(sId.toString());
          } else {
            reservedSeatIds.add(sId.toString());
          }
        }
      }
    }

    // Map each seat with its dynamic status
    const mappedSeats = seats.map((seat) => {
      let status = 'available';
      if (bookedSeatIds.has(seat._id.toString())) {
        status = 'booked';
      } else if (reservedSeatIds.has(seat._id.toString())) {
        status = 'reserved';
      }
      
      const dynamicPrice = calculateDynamicSeatPrice(trip, fromStationId, toStationId, seat);
      
      return {
        ...seat,
        status,
        price: dynamicPrice,
        type: seat.seatType || 'Standard',
      };
    });

    const stats = {
      total: mappedSeats.length,
      available: mappedSeats.filter((s) => s.status === 'available').length,
      reserved: mappedSeats.filter((s) => s.status === 'reserved').length,
      booked: mappedSeats.filter((s) => s.status === 'booked').length,
    }

    return res.json({
      success: true,
      msg: 'Seats fetched successfully',
      data: {
        tripId: trip._id,
        trainId: trip.train._id,
        stats,
        seats: mappedSeats,
      },
    })
  } catch (err) {
    return res.status(500).json({ success: false, msg: err.message })
  }
}
// ✅ HOLD/BOOK مع أو بدون إيميل أو دفع
exports.bookOrHoldSeatWithPayment = async (req, res) => {
  const isReplicaSet = mongoose.connection.client?.topology?.description?.type?.toLowerCase().includes('replicaset') || false;
  const session = isReplicaSet ? await mongoose.startSession() : null;
  let committed = false

  try {
    if (session) session.startTransaction()

    const { tripId, action, userEmail, transactionId, paid, passengers, from, to } =
      req.body

    if (!mongoose.Types.ObjectId.isValid(tripId)) {
      throw new Error('Invalid trip ID')
    }

    const trip = await Trip.findById(tripId)
      .populate('train fromStation toStation stops.station') // ✅ استخدم stops
      .session(session)

    if (!trip || trip.deleted) throw new Error('Trip not found')
    if (new Date(trip.departureDate) <= new Date())
      throw new Error('Trip already departed')

    // Resolve boarding and destination stations
    let fromStationId = from ? await resolveStationId(from) : null;
    let toStationId = to ? await resolveStationId(to) : null;

    if (!fromStationId) fromStationId = trip.fromStation._id.toString();
    if (!toStationId) toStationId = trip.toStation._id.toString();

    const fromIndex = getStationOrder(trip, fromStationId);
    const toIndex = getStationOrder(trip, toStationId);
    const totalSegments = (trip.stops || []).length + 1;

    const user = userEmail
      ? await User.findOne({ email: userEmail }).session(session)
      : null

    let updatedSeats = []
    let passengerDocs = []
    let seatNumbers = []
    let seatMap = {}

    for (const p of passengers) {
      if (!mongoose.Types.ObjectId.isValid(p.seatId)) {
        throw new Error('Invalid seat ID')
      }

      const seat = await Seat.findOne({ _id: p.seatId, trip: tripId }).session(
        session
      )
      if (!seat) throw new Error(`Seat ${p.seatId} not found`)

      seatMap[seat._id.toString()] = seat;

      // تحقق من التداخل بين قطاعات الحجز النشطة لنفس الكرسي والرحلة
      const seatBookings = await Booking.find({
        trip: tripId,
        status: { $in: ['active', 'cancelling'] },
        paymentStatus: { $in: ['paid', 'pending'] },
        deleted: { $ne: true },
        $or: [
          { 'bookingSegments.seat': p.seatId },
          { 'seats': p.seatId }
        ]
      }).session(session).lean();

      for (const b of seatBookings) {
        if (b.bookingSegments && b.bookingSegments.length > 0) {
          for (const seg of b.bookingSegments) {
            if (seg.seat && seg.seat.toString() === p.seatId.toString()) {
              const segFrom = seg.fromIndex !== undefined ? seg.fromIndex : 0;
              const segTo = seg.toIndex !== undefined ? seg.toIndex : totalSegments;
              const overlap = segFrom < toIndex && segTo > fromIndex;
              if (overlap) {
                if (b.paymentStatus === 'paid') {
                  throw new Error(`Seat ${seat.seatNumber} already booked for segment ${from || trip.fromStation.name} -> ${to || trip.toStation.name}`);
                } else if (action === 'hold') {
                  throw new Error(`Seat ${seat.seatNumber} already reserved for segment ${from || trip.fromStation.name} -> ${to || trip.toStation.name}`);
                }
              }
            }
          }
        } else {
          // Legacy check
          if (b.paymentStatus === 'paid') {
            throw new Error(`Seat ${seat.seatNumber} already booked for this trip`);
          } else if (action === 'hold') {
            throw new Error(`Seat ${seat.seatNumber} already reserved for this trip`);
          }
        }
      }

      seat.status = action === 'book' ? 'booked' : 'reserved'
      seat.reservedBy = user ? user._id : null
      seat.reservedAt = new Date()
      await seat.save({ session })

      updatedSeats.push(seat._id)
      seatNumbers.push(
        `Seat ${seat.seatNumber} (${seat.classType}, ${seat.seatType})`
      )

      const seatPrice = calculateDynamicSeatPrice(trip, fromStationId, toStationId, seat);

      passengerDocs.push({
        name: p.fullName || 'Passenger',
        phone: p.phone,
        nationalId: p.nationalId,
        profileType: p.profileType,
        nationality: p.nationality,
        gender: p.gender ? p.gender.toLowerCase() : undefined,
        bookingSegmentIndex: 0,
        ticketPrice: seatPrice,
        ticketCode: 'TICKET_' + Date.now() + '_' + seat.seatNumber,
        email: userEmail,
      })
    }

    let paymentStatus = paid ? 'paid' : 'pending'
    const bookingCode =
      'BOOK_' + Date.now() + '_' + Math.floor(Math.random() * 10000)

    const qrData = `BOOKING:${bookingCode}|SEATS:${updatedSeats.join(',')}|USER:${userEmail}`
    const qrCodeImage = await QRCode.toDataURL(qrData)

    const bookingSegments = updatedSeats.map((seatId) => {
      const seat = seatMap[seatId.toString()];
      const price = seat ? calculateDynamicSeatPrice(trip, fromStationId, toStationId, seat) : trip.price;
      return {
        seat: seatId,
        fromStation: fromStationId,
        toStation: toStationId,
        fromIndex: fromIndex !== -1 ? fromIndex : 0,
        toIndex: toIndex !== -1 ? toIndex : totalSegments,
        price
      };
    });

    const booking = await Booking.create(
      [
        {
          user: user ? user._id : null,
          trip: tripId,
          seats: updatedSeats,
          bookingSegments,
          bookingCode,
          paymentStatus,
          transactionId: transactionId || null,
          paidAt: paid ? new Date() : null,
          qrCode: qrCodeImage,
          passengers: passengerDocs,
        },
      ],
      { session }
    )

    if (session) await session.commitTransaction()
    committed = true

    const tripInfo = {
      trainName: trip.train.name,
      trainType: trip.train.type,
      coaches: trip.train.coaches,
      createdAt: trip.train.createdAt,
      features: trip.train.features,
      fromStation: {
        name: trip.fromStation.name,
        coordinates: trip.fromStation.coordinates,
      },
      toStation: {
        name: trip.toStation.name,
        coordinates: trip.toStation.coordinates,
      },
      departure: trip.departureDate,
      arrival: trip.arrivalDate,
      route: trip.train.route,
      stops: getNormalizedStops(trip.stops, trip.departureDate).map((s) => ({
        station: s.station.name,
        coordinates: s.station.coordinates,
        arrivalTime: s.arrivalTime,
        departureTime: s.departureTime,
      })),
    }

    if (userEmail) {
      const emailData = {
        userName: userEmail,
        seatNumbers,
        passengers: passengerDocs,
        totalPrice: passengerDocs.reduce((sum, p) => sum + p.ticketPrice, 0),
        qrCode: booking[0].qrCode,
        tripInfo,
      }
      if (action === 'book') {
        await sendBookedTicketEmail(userEmail, emailData)
      } else {
        await sendHoldTicketEmail(userEmail, emailData)
      }
    }

    return res.json({
      success: true,
      msg: `Seats ${action}ed successfully`,
      data: {
        seats: updatedSeats,
        booking: {
          ...booking[0].toObject(),
          bookingCode: booking[0].bookingRef || bookingCode,
          totalPrice: passengerDocs.reduce((sum, p) => sum + p.ticketPrice, 0)
        },
        paidStatus: paid
      },
    })
  } catch (err) {
    if (session && !committed) await session.abortTransaction()
    return res.status(500).json({ success: false, msg: err.message })
  } finally {
    if (session) session.endSession()
  }
}

exports.cancelBooking = async (req, res) => {
  const isReplicaSet = mongoose.connection.client?.topology?.description?.type?.toLowerCase().includes('replicaset') || false;
  const session = isReplicaSet ? await mongoose.startSession() : null;
  let committed = false

  try {
    if (session) session.startTransaction()

    const { id } = req.params
    const now = new Date()
    const authUserId = req.user?.id || null
    const authUserEmail = req.user?.email?.toLowerCase().trim() || null
    const { bookingCode, email, phone } = req.body

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new Error('Invalid booking id')
    }

    // =========================================
    // GET BOOKING
    // =========================================
    const booking = await Booking.findOne({ _id: id, deleted: false })
      .populate({
        path: 'trip',
        populate: [
          { path: 'fromStation', select: 'name' },
          { path: 'toStation', select: 'name' },
          { path: 'train', select: 'number type' },
        ],
      })
      .session(session)

    if (!booking) throw new Error('Booking not found')

    // =========================================
    // VALIDATE BOOKING CODE
    // =========================================
    if (bookingCode && booking.bookingCode !== bookingCode) {
      throw new Error('Invalid booking code')
    }

    // =========================================
    // PREVENT DUPLICATES
    // =========================================
    if (['cancelled', 'cancelling'].includes(booking.status)) {
      throw new Error('Booking already cancelling/cancelled')
    }
    if (['refunded', 'refund_pending'].includes(booking.paymentStatus)) {
      throw new Error('Refund already processed')
    }

    // =========================================
    // PREVENT AFTER DEPARTURE
    // =========================================
    if (new Date(booking.trip.departureDate) <= now) {
      throw new Error('Cannot cancel after departure')
    }

    // =========================================
    // LOCK BOOKING
    // =========================================
    booking.status = 'cancelling'
    await booking.save({ session })

    // =========================================
    // REFUND RULE
    // =========================================
    const refundDeadline = new Date(booking.trip.departureDate)
    refundDeadline.setHours(refundDeadline.getHours() - 24)
    const allowRefund = now < refundDeadline
    const refundTasks = []

    // =========================================
    // CHECK OWNER
    // =========================================
    const isOwner = authUserId && booking.user?.toString() === authUserId

    // =========================================
    // OWNER FULL CANCELLATION
    // =========================================
    if (isOwner) {
      await Seat.updateMany(
        {
          _id: { $in: booking.seats },
          trip: booking.trip._id,
          status: 'booked',
          deleted: false,
        },
        {
          $set: {
            status: 'available',
            lockedBy: null,
            lockedUntil: null,
            bookedAt: null,
          },
        },
        { session }
      )

      booking.passengers.forEach((p) => {
        if (!p.cancelled) {
          p.cancelled = true
          p.cancelledAt = now
          p.cancelledBy = authUserId
        }
      })

      booking.status = 'cancelled'
      booking.cancelledAt = now

      if (booking.paymentStatus === 'paid' && allowRefund) {
        const amount =
          booking.passengers.reduce((sum, p) => sum + (p.ticketPrice || 0), 0) *
          100
        refundTasks.push({
          type: 'full',
          transactionId: booking.transactionId,
          amount,
        })
      }

      await booking.save({ session })
    }

    // =========================================
    // GUEST / PASSENGER PARTIAL CANCEL
    // =========================================
    else {
      let passengerIndex = -1
      if (authUserEmail) {
        passengerIndex = booking.passengers.findIndex(
          (p) => p.email?.toLowerCase().trim() === authUserEmail
        )
      }
      if (passengerIndex === -1 && (email || phone)) {
        passengerIndex = booking.passengers.findIndex((p) => {
          const sameEmail =
            email &&
            p.email?.toLowerCase().trim() === email?.toLowerCase().trim()
          const samePhone = phone && p.phone === phone
          return sameEmail || samePhone
        })
      }
      if (passengerIndex === -1) throw new Error('Not authorized')

      const passenger = booking.passengers[passengerIndex]
      if (passenger.cancelled) throw new Error('Passenger already cancelled')
      if (passenger.refunded || passenger.refundPending)
        throw new Error('Refund already processed')

      // release seat
      if (passenger.seatId) {
        await Seat.updateOne(
          {
            _id: passenger.seatId,
            trip: booking.trip._id,
            status: 'booked',
            deleted: false,
          },
          {
            $set: {
              status: 'available',
              lockedBy: null,
              lockedUntil: null,
              bookedAt: null,
            },
          },
          { session }
        )
      }

      passenger.cancelled = true
      passenger.cancelledAt = now
      passenger.cancelledBy = authUserId || null

      if (booking.paymentStatus === 'paid' && allowRefund) {
        refundTasks.push({
          type: 'partial',
          passengerIndex,
          transactionId: booking.transactionId,
          amount: (passenger.ticketPrice || 0) * 100,
        })
      }

      const activePassengers = booking.passengers.filter((p) => !p.cancelled)
      if (activePassengers.length === 0) {
        booking.status = 'cancelled'
        booking.cancelledAt = now
      }

      await booking.save({ session })
    }

    // =========================================
    // COMMIT
    // =========================================
    if (session) await session.commitTransaction()
    committed = true

    // =========================================
    // EXECUTE REFUNDS
    // =========================================
    for (const task of refundTasks) {
      const result = await refundPayment(task.transactionId, task.amount)
      if (result.success) {
        if (task.type === 'full') {
          await Booking.findByIdAndUpdate(id, {
            paymentStatus: 'refund_pending',
            refundRequestedAt: new Date(),
          })
        } else {
          await Booking.updateOne(
            { _id: id },
            {
              $set: {
                [`passengers.${task.passengerIndex}.refundPending`]: true,
                [`passengers.${task.passengerIndex}.refundRequestedAt`]:
                  new Date(),
                paymentStatus: 'partially_refund_pending',
              },
            }
          )
        }
      } else {
        await Booking.findByIdAndUpdate(id, { paymentStatus: 'refund_failed' })
      }
    }

    // =========================================
    // RESPONSE
    // =========================================
    return res.json({
      success: true,
      msg: allowRefund
        ? 'Your cancellation request has been sent successfully to the payment provider. Waiting for refund to be processed.'
        : 'Your booking has been cancelled successfully (no refund available).',
      data: {
        bookingId: booking._id,
        bookingCode: booking.bookingCode,
        paidStatus: booking.paymentStatus === 'paid',
        refundStatus: booking.paymentStatus.includes('refund')
          ? booking.paymentStatus
          : 'none',
      },
    })
  } catch (err) {
    if (session && !committed) await session.abortTransaction()
    console.error('cancelBooking:', err)
    return res.status(500).json({ success: false, msg: err.message })
  } finally {
    if (session) session.endSession()
  }
}
exports.getMyBookById = async (req, res) => {
  try {
    const { id } = req.params
    const { email, phone } = req.body

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return sendRes(res, {
        success: false,
        msg: 'Invalid booking id',
        status: 400,
      })
    }

    const authUserId = req.user?.id || null
    const authUserEmail = req.user?.email?.toLowerCase().trim() || null

    const booking = await Booking.findOne({ _id: id, deleted: false })
      .populate({
        path: 'trip',
        populate: [
          { path: 'fromStation', select: 'name' },
          { path: 'toStation', select: 'name' },
          { path: 'train', select: 'number type' },
        ],
      })
      .populate({
        path: 'seats',
        select: 'seatNumber classType coach price status',
      })
      .lean()

    if (!booking) {
      return sendRes(res, {
        success: false,
        msg: 'Booking not found',
        status: 404,
      })
    }

    const isOwner = authUserId && booking.user?.toString() === authUserId
    let passengers = booking.passengers || []

    // =========================================
    // ACCESS CONTROL (مرن: يسمح بدون إيميل)
    // =========================================
    if (!isOwner) {
      passengers = passengers.filter((p) => {
        const sameEmail =
          email && p.email?.toLowerCase().trim() === email?.toLowerCase().trim()
        const samePhone = phone && p.phone === phone
        const sameAuthEmail =
          authUserEmail && p.email?.toLowerCase().trim() === authUserEmail
        return sameEmail || samePhone || sameAuthEmail
      })

      // ✅ حتى لو مفيش إيميل أو هاتف، نسمح بعرض التذكرة داخل التطبيق
      if (passengers.length === 0 && !email && !phone && !authUserEmail) {
        passengers = booking.passengers // عرض كل الركاب كـ history
      }

      if (passengers.length === 0) {
        return sendRes(res, {
          success: false,
          msg: 'Not authorized to view this booking',
          status: 403,
        })
      }
    }

    // =========================================
    // RESPONSE مع عرض التذكرة
    // =========================================
    return sendRes(res, {
      success: true,
      msg: 'Booking fetched successfully',
      data: {
        booking: {
          id: booking._id,
          bookingCode: booking.bookingCode,
          trip: booking.trip,
          seats: booking.seats,
          passengers,
          totalPrice: booking.totalPrice,
          paymentStatus: booking.paymentStatus,
          status: booking.status,
          createdAt: booking.createdAt,
          qrCode: booking.qrCode,
          // ✅ إضافة ticketCode لكل راكب
          tickets: passengers.map((p) => ({
            passengerName: p.name,
            seatId: p.seatId,
            ticketCode: p.ticketCode,
            cancelled: p.cancelled || false,
          })),
        },
      },
    })
  } catch (err) {
    return sendRes(res, {
      success: false,
      msg: err.message,
      status: 500,
    })
  }
}

exports.getValidDestinations = async (req, res) => {
  try {
    const { from } = req.query
    if (!from) {
      return res.status(400).json({ success: false, msg: 'from station is required' })
    }

    const fromStationId = await resolveStationId(from)
    if (!fromStationId) {
      return res.status(400).json({ success: false, msg: 'Invalid from station' })
    }

    // Find all scheduled, non-deleted trips that include the from station
    const query = {
      deleted: false,
      status: 'scheduled',
      $or: [
        { fromStation: fromStationId },
        { 'stops.station': fromStationId }
      ]
    }

    const trips = await Trip.find(query)
      .populate('fromStation toStation stops.station')
      .lean()

    const uniqueDestinations = new Map()

    for (const trip of trips) {
      const fromOrder = getStationOrder(trip, fromStationId)
      if (fromOrder < 0) continue

      const stops = trip.stops || []
      const totalSegments = stops.length + 1

      // Check stops that are after fromStationId
      for (let i = 0; i < stops.length; i++) {
        const stopOrder = i + 1
        if (stopOrder > fromOrder && stops[i].station) {
          const station = stops[i].station
          const gov = stationNameToGovernorate[station.name]
          if (gov && !uniqueDestinations.has(gov)) {
            uniqueDestinations.set(gov, {
              _id: station._id,
              name: station.name,
              displayName: gov
            })
          }
        }
      }

      // Check toStation
      const toOrder = totalSegments
      if (toOrder > fromOrder && trip.toStation) {
        const station = trip.toStation
        const gov = stationNameToGovernorate[station.name]
        if (gov && !uniqueDestinations.has(gov)) {
          uniqueDestinations.set(gov, {
            _id: station._id,
            name: station.name,
            displayName: gov
          })
        }
      }
    }

    const destinations = Array.from(uniqueDestinations.values())
    destinations.sort((a, b) => a.displayName.localeCompare(b.displayName))

    return res.json({
      success: true,
      msg: 'Destinations fetched successfully',
      count: destinations.length,
      data: destinations
    })
  } catch (err) {
    return res.status(500).json({ success: false, msg: err.message })
  }
}

//todo : get my book by bookingId
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
//todo getMyBooks
//todo holdSeat
//todo getSeatsByTrip
//todo getTripRoute
//todo confirmPayment
//?----------------
