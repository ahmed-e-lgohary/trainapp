const cron = require("node-cron");
const Trip = require("../models/Trip");

// =====================================================
// AUTO UPDATE TRIPS DAILY (UPDATE OLDEST TRIP)
// =====================================================
cron.schedule("0 0 * * *", async () => {
  try {
    console.log("Running daily trip auto-update (update mode)...");

    // هات كل الرحلات غير المحذوفة
    const trips = await Trip.find({ deleted: false }).sort({
      departureDate: 1,
    });

    if (!trips.length) {
      console.log("No trips found to update");
      return;
    }

    // أقدم رحلة
    const oldestTrip = trips[0];
    const lastTrip = trips[trips.length - 1];

    // اليوم الجديد = آخر يوم + 1
    const newDate = new Date(lastTrip.departureDate);
    newDate.setDate(newDate.getDate() + 1);

    // تحديث الرحلة الأقدم لتصبح بتاريخ جديد
    await Trip.updateOne(
      { _id: oldestTrip._id },
      {
        departureDate: newDate,
        arrivalDate: new Date(newDate.getTime() + 12 * 60 * 60 * 1000), // مثال: 12 ساعة بعد
        deleted: false,
        status: "scheduled",
        updatedAt: new Date(),
      },
    );

    console.log("Oldest trip updated to new date:", newDate);
  } catch (err) {
    console.error("Error updating trips:", err.message);
  }
});
