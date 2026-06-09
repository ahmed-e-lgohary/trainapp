require("dns").setDefaultResultOrder("ipv4first");
console.log(process.env.MONGO_URI);

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}
// app.js

require("./cron/tripCron");
const mongoose = require("mongoose");
const express = require("express");
const path = require("path");
const helmet = require("helmet");
const morgan = require("morgan");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const compression = require("compression");

const Booking = require("./models/Booking");
const Seat = require("./models/Seat");

const usersRoutes = require("./routes/Users");
const emailRoutes = require("./routes/Email");
const adminRoutes = require("./routes/Admin");
const commissaryRoutes = require("./routes/Commissary");
const dbViewerRoutes = require("./routes/DbViewer");
const { swaggerUi, swaggerSpec } = require("./swagger");
console.log("🔥 NEW VERSION RUNNING");
const app = express();
const API_PREFIX = "/api/v1";

// Security
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false,
  }),
);

app.use(
  cors({
    origin: process.env.CLIENT_URL || true,
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE"],
  }),
);

app.set("trust proxy", 1);

// Rate limit
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20000,
});
app.use(globalLimiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10000,
  message: {
    success: false,
    msg: "Too many requests, try again later",
  },
});
app.use(`${API_PREFIX}/email`, authLimiter);

// Middleware
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));
app.use(compression());

// (لو عندك CORS أو middlewares تانية)

app.use(cors());

// // ✅ استيراد الكونترولر
// const { paymobWebhook } = require("./controllers/User");

// // 👇 هنا تحط الـ webhook route
// app.post("/api/paymob/webhook", paymobWebhook);

const notFound = (req, res, next) => {
  res.status(404).json({
    success: false,
    msg: "Route not found",
  });
};

app.get("/api/v1", (req, res) => {
  res.send("API is running...");
});
// Routes
app.use(`${API_PREFIX}/users`, usersRoutes);
app.use(`${API_PREFIX}/email`, emailRoutes);
app.use(`${API_PREFIX}/admin`, adminRoutes);
app.use(`${API_PREFIX}/commissary`, commissaryRoutes);
app.use("/db-viewer", dbViewerRoutes);
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(notFound);
// ENV CHECK
const requiredEnv = [
  "JWT_SECRET",
  "EMAIL_USER",
  "EMAIL_PASS",
  "EMAIL_SECRET",
  "MONGO_URI",
];

requiredEnv.forEach((key) => {
  if (!process.env[key]) {
    console.error(`❌ Missing env: ${key}`);
    process.exit(1);
  }
});

// mongodb://saabdol0100_db_user:evdRfWofTA60cqw5@ac-runubl4-shard-00-00.x00r3ba.mongodb.net:27017,ac-runubl4-shard-00-01.x00r3ba.mongodb.net:27017,ac-runubl4-shard-00-02.x00r3ba.mongodb.net:27017/trainbooking?ssl=true&replicaSet=atlas-ib7qsk-shard-0&authSource=admin&retryWrites=true&w=majority&appName=Cluster0
const fs = require("fs");

// Helper to parse MongoDB Extended JSON (like $oid and $date)
function parseExtendedJson(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) {
    return obj.map(parseExtendedJson);
  }
  if (typeof obj === "object") {
    if ("$oid" in obj) {
      return new mongoose.Types.ObjectId(obj.$oid);
    }
    if ("$date" in obj) {
      if (typeof obj.$date === "object" && "$numberLong" in obj.$date) {
        return new Date(parseInt(obj.$date.$numberLong, 10));
      }
      return new Date(obj.$date);
    }
    if ("$numberLong" in obj) {
      return parseInt(obj.$numberLong, 10);
    }
    if ("$numberInt" in obj) {
      return parseInt(obj.$numberInt, 10);
    }
    if ("$numberDouble" in obj) {
      return parseFloat(obj.$numberDouble);
    }
    const newObj = {};
    for (const key in obj) {
      newObj[key] = parseExtendedJson(obj[key]);
    }
    return newObj;
  }
  return obj;
}

const seedDatabaseIfEmpty = async () => {
  const Station = require("./models/Station");
  const count = await Station.countDocuments();
  if (count > 0) {
    console.log("💾 Database already has stations, skipping auto-seed.");
    return;
  }

  console.log("💾 Database is empty. Seeding realistic template data...");
  const User = require("./models/User");
  const Train = require("./models/Train");
  const Trip = require("./models/Trip");
  const Seat = require("./models/Seat");

  const seedFiles = [
    { file: "users.json", model: User, name: "Users" },
    { file: "stations.json", model: Station, name: "Stations" },
    { file: "trains.json", model: Train, name: "Trains" },
    { file: "trips.json", model: Trip, name: "Trips" },
  ];

  for (const { file, model, name } of seedFiles) {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
      console.log(`⏳ Seeding ${name} from ${file}...`);
      const rawData = fs.readFileSync(filePath, "utf-8");
      if (rawData.trim()) {
        let parsed = parseExtendedJson(JSON.parse(rawData));
        
        if (name === "Trains") {
          parsed = parsed.map(doc => {
            doc.totalSeats =
              (doc.classes?.VIP || 0) +
              (doc.classes?.First || 0) +
              (doc.classes?.Second || 0);
            doc.searchableName = (doc.name || "").toLowerCase();
            return doc;
          });
        } else if (name === "Stations") {
          parsed = parsed.map(doc => {
            doc.normalizedName = (doc.name || "").toLowerCase().trim();
            return doc;
          });
        } else if (name === "Trips") {
          parsed = parsed.map(doc => {
            doc.route = doc.route || new mongoose.Types.ObjectId();
            doc.fromIndex = doc.fromIndex !== undefined ? doc.fromIndex : 0;
            doc.toIndex = doc.toIndex !== undefined ? doc.toIndex : 1;
            if (doc.durationMinutes === undefined) {
              const dep = new Date(doc.departureDate);
              const arr = new Date(doc.arrivalDate);
              doc.durationMinutes = Math.round((arr - dep) / (1000 * 60)) || 60;
            }
            return doc;
          });
        }

        await model.insertMany(parsed);
        console.log(`✅ Seeded ${parsed.length} ${name}`);
      }
    }
  }

  // Generate seats dynamically for all seeded trips
  console.log("⏳ Generating realistic physical seats for all seeded trips...");
  const seededTrips = await Trip.find({ deleted: false });
  const allTrains = await Train.find({ deleted: false });
  const trainMap = new Map(allTrains.map(t => [t._id.toString(), t]));

  let totalGeneratedSeats = 0;
  for (const trip of seededTrips) {
    const trainDoc = trainMap.get(trip.train.toString());
    if (trainDoc) {
      const seats = [];
      let seatNumber = 1;
      const basePrice = trip.price || 100;

      // VIP Class (2+1 Layout)
      const vipCount = trainDoc.classes?.VIP || 0;
      for (let i = 0; i < vipCount; i++) {
        const posInGroup = i % 3;
        const seatType = posInGroup === 1 ? 'Aisle' : 'Window';
        seats.push({
          trip: trip._id,
          train: trainDoc._id,
          seatNumber: seatNumber++,
          classType: 'VIP',
          seatType,
          status: 'available',
          price: Math.round(basePrice * 1.5),
          deleted: false,
        });
      }

      // First Class (2+1 Layout)
      const firstCount = trainDoc.classes?.First || 0;
      for (let i = 0; i < firstCount; i++) {
        const posInGroup = i % 3;
        const seatType = posInGroup === 1 ? 'Aisle' : 'Window';
        seats.push({
          trip: trip._id,
          train: trainDoc._id,
          seatNumber: seatNumber++,
          classType: 'First',
          seatType,
          status: 'available',
          price: Math.round(basePrice * 1.2),
          deleted: false,
        });
      }

      // Second Class (2+2 Layout)
      const secondCount = trainDoc.classes?.Second || 0;
      for (let i = 0; i < secondCount; i++) {
        const posInGroup = i % 4;
        const seatType = (posInGroup === 0 || posInGroup === 3) ? 'Window' : 'Aisle';
        seats.push({
          trip: trip._id,
          train: trainDoc._id,
          seatNumber: seatNumber++,
          classType: 'Second',
          seatType,
          status: 'available',
          price: basePrice,
          deleted: false,
        });
      }

      if (seats.length > 0) {
        await Seat.insertMany(seats);
        totalGeneratedSeats += seats.length;
      }
    }
  }
  console.log(`✅ Auto-generated ${totalGeneratedSeats} layout seats for ${seededTrips.length} seeded trips!`);
};

// DATABASE
mongoose
  .connect(process.env.MONGO_URI, {
    autoIndex: process.env.NODE_ENV !== "production",
  })
  .then(async () => {
    console.log("✅ MongoDB connected");
    await seedDatabaseIfEmpty().catch(err => {
      console.error("❌ Auto-seeding failed:", err.message);
    });
    const PORT = process.env.PORT || 3000;
    app.listen(PORT, "0.0.0.0", () => {
      console.log(
        `🚀 Server running on port ${PORT} ${process.env.EMAIL_PASS}`,
      );
    });
    // Fix all trips dates
    // if (typeof updateAllTrips === "function") {
    //   updateAllTrips();
    // }
  })
  .catch((err) => {
    console.error("❌ DB error:", err.message);
    process.exit(1);
  });

mongoose.connection.once("open", () => {
  console.log("Connected DB:", mongoose.connection.name);
  console.log("Host:", mongoose.connection.host);
});
// Cleanup jobs only on primary machine
if (process.env.IS_PRIMARY === "true") {
  // Cleanup unpaid bookings
  setInterval(
    async () => {
      try {
        const expired = await Booking.find({
          paymentStatus: "pending",
          status: "active",
          createdAt: { $lt: new Date(Date.now() - 10 * 60 * 1000) },
        }).lean();

        if (!expired.length) return;

        const bookingIds = expired.map((b) => b._id);
        const seatIds = expired.flatMap((b) => b.seats || []);

        await Booking.updateMany(
          { _id: { $in: bookingIds } },
          { status: "cancelled" },
        );

        await Seat.updateMany(
          { _id: { $in: seatIds } },
          {
            status: "available",
            reservedBy: null,
            expireAt: null,
          },
        );

        console.log(`🧹 Cancelled ${expired.length} unpaid bookings`);
      } catch (err) {
        console.error("Cleanup booking error:", err.message);
      }
    },
    5 * 60 * 1000,
  );

  // Cleanup expired seats
  setInterval(async () => {
    try {
      const result = await Seat.updateMany(
        {
          status: "reserved",
          expireAt: { $lt: new Date() },
        },
        {
          status: "available",
          reservedBy: null,
          expireAt: null,
        },
      );

      if (result.modifiedCount > 0) {
        console.log(`🧹 Released ${result.modifiedCount} expired seats`);
      }
    } catch (err) {
      console.error("Seat cleanup error:", err.message);
    }
  }, 60 * 1000);
}

// 404
app.use((req, res) => {
  res.status(404).json({
    success: false,
    msg: "Route not found",
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error("❌ Error:", err.stack);

  res.status(err.status || 500).json({
    success: false,
    msg: err.message || "Internal Server Error",
    ...(process.env.NODE_ENV !== "production" && { stack: err.stack }),
  });
});

// Process handlers
process.on("unhandledRejection", (err) => {
  console.error("UNHANDLED REJECTION:", err);
});

process.on("uncaughtException", (err) => {
  console.error("UNCAUGHT EXCEPTION:", err);
  process.exit(1);
});

module.exports = app;
async function updateAllTrips() {
  try {
    const Trip = require("./models/Trip");
    console.log("Updating all trips to start from today...");

    const trips = await Trip.find().sort({ departureDate: 1 });
    if (!trips.length) {
      console.log("No trips found");
      return;
    }

    const today = new Date();
    today.setHours(7, 0, 0, 0); // أول رحلة الساعة 7 صباحًا

    for (let i = 0; i < trips.length && i < 30; i++) {
      const newDeparture = new Date(today);
      newDeparture.setDate(today.getDate() + i);

      const newArrival = new Date(newDeparture.getTime() + 12 * 60 * 60 * 1000);

      // تزحزح الـ stops بنفس الفرق
      const updatedStops = trips[i].stops.map((stop) => {
        const diffDays =
          (newDeparture - new Date(trips[i].departureDate)) /
          (1000 * 60 * 60 * 24);
        const arrival = new Date(stop.arrivalTime);
        const departure = new Date(stop.departureTime);
        arrival.setDate(arrival.getDate() + diffDays);
        departure.setDate(departure.getDate() + diffDays);
        return { ...stop, arrivalTime: arrival, departureTime: departure };
      });

      await Trip.updateOne(
        { _id: trips[i]._id },
        {
          departureDate: newDeparture,
          arrivalDate: newArrival,
          stops: updatedStops,
          deleted: false,
          status: "scheduled",
          updatedAt: new Date(),
        },
      );
    }

    console.log("All trips updated to start from today");
  } catch (err) {
    console.error("Error updating trips:", err.message);
  }
};

// ????
/**
 
SRV : service record 
flush : clear completley / in force 
ipconfig : 
flushdns 
netsh : network shell 
windsock reset dns : windows socket reset 

*/

// auth with link to vefiy pass instead 1 step 2 step otp
