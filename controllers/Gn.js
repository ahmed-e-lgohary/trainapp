const fs = require("fs");

const trainId = "6a07f8b05175f779df23d249"; // Nile Express
const fromStation = "6a07f72d5175f779df23d173"; // Cairo Central Station
const toStation = "6a07f72d5175f779df23d18b"; // Aswan Station

const stopsTemplate = [
  { station: "6a07f72d5175f779df23d174", offsetArr: 30, offsetDep: 40 }, // Giza
  { station: "6a07f72d5175f779df23d17f", offsetArr: 120, offsetDep: 130 }, // Beni Suef
  { station: "6a07f72d5175f779df23d180", offsetArr: 240, offsetDep: 250 }, // Minya
  { station: "6a07f72d5175f779df23d184", offsetArr: 360, offsetDep: 370 }, // Sohag
  { station: "6a07f72d5175f779df23d187", offsetArr: 480, offsetDep: 490 }, // Qena
  { station: "6a07f72d5175f779df23d189", offsetArr: 600, offsetDep: 610 }, // Luxor
];

const trips = [];
// ✅ غيّر تاريخ البداية للأسبوع القادم
const startDate = new Date("2026-05-24T07:00:00Z");

for (let i = 0; i < 100; i++) {
  const depDate = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
  const arrDate = new Date(depDate.getTime() + 12 * 60 * 60 * 1000);

  const stops = stopsTemplate.map((s) => ({
    station: s.station,
    arrivalTime: new Date(
      depDate.getTime() + s.offsetArr * 60 * 1000,
    ).toISOString(),
    departureTime: new Date(
      depDate.getTime() + s.offsetDep * 60 * 1000,
    ).toISOString(),
  }));

  trips.push({
    train: trainId,
    fromStation,
    toStation,
    departureDate: depDate.toISOString(),
    arrivalDate: arrDate.toISOString(),
    price: 300,
    stops,
  });
}

fs.writeFileSync("trips_next_week.json", JSON.stringify({ trips }, null, 2));
console.log("✅ trips_next_week.json generated with 100 trips");
