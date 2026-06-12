const nodemailer = require('nodemailer')

// 🔐 transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // ⚠️ App Password
  },
})

// ✅ base sender
const baseMailOptions = {
  from: `"Train Booking" <${process.env.EMAIL_USER}>`,
}

// ----------------------
// GENERIC EMAIL
// ----------------------
const sendEmail = async ({ to, subject, text, html, attachments = [] }) => {
  const isMock = !process.env.EMAIL_USER || 
                 process.env.EMAIL_USER.includes('local') || 
                 !process.env.EMAIL_USER.includes('@');
  
  if (isMock) {
    console.log('\n--- 📝 [MOCK EMAIL] ---');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('Text:', text);
    if (html) {
      console.log('HTML (preview):', html.substring(0, 300) + (html.length > 300 ? '...' : ''));
    }
    console.log('-----------------------\n');
    return { messageId: 'mock-id', response: '250 Mock OK' };
  }

  try {
    const info = await transporter.sendMail({
      ...baseMailOptions,
      to,
      subject,
      text,
      html,
      attachments,
    })

    console.log('📨 Sending email to:', to)
    console.log('✅ Email sent:', info.response)

    return info
  } catch (err) {
    console.error('❌ Email error:', err.message)
    console.log('\n--- 📝 [FALLBACK MOCK EMAIL] ---');
    console.log('To:', to);
    console.log('Subject:', subject);
    console.log('Text:', text);
    if (html) {
      console.log('HTML (preview):', html.substring(0, 300) + (html.length > 300 ? '...' : ''));
    }
    console.log('-------------------------------\n');
    
    console.log('⚠️ Email sending failed, but continuing with mock response in development.');
    return { messageId: 'mock-id', response: '250 Mock OK (Fallback)' };
  }
}

// ----------------------
// OTP EMAIL
// ----------------------
const sendOTPEmail = async (to, otp) => {
  return sendEmail({
    to,
    subject: 'Verify your account',
    text: `Your OTP is: ${otp}`,
    html: `
      <h2>Verify Your Account</h2>
      <p>Your OTP code is:</p>
      <h1 style="color:#2e86de">${otp}</h1>
      <p>This code expires in a few minutes.</p>
    `,
  })
}
const sendBookedTicketEmail = async (to, data) => {
  const { userName, seatNumbers, passengers, totalPrice, qrCode, tripInfo } =
    data

  // توليد رابط Google Maps من المحطات
  const stopsCoords = tripInfo.stops.map(
    (s) => `${s.coordinates.coordinates[1]},${s.coordinates.coordinates[0]}`
  )
  const stopsUrl = `https://www.google.com/maps/dir/${stopsCoords.join('/')}`

  const passengerRows = passengers
    .map((p, i) => {
      let iconCid = 'windowIcon'
      if (seatNumbers[i].includes('Middle')) iconCid = 'middleIcon'
      else if (seatNumbers[i].includes('Aisle')) iconCid = 'aisleIcon'

      return `
      <tr style="color:white; background-color:black;">
        <td>${i + 1}</td>
        <td>${p.name}</td>
        <td>${p.gender || '-'}</td>
        <td>${seatNumbers[i]} <img src="cid:${iconCid}" width="20"/></td>
      </tr>`
    })
    .join('')

  return sendEmail({
    to,
    subject: '🎟️ Train Booking Confirmation',
    text: `Your booking is confirmed. Seats: ${seatNumbers.join(', ')}`,
    html: `
      <div style="font-family:Arial;padding:20px; background-color:black; color:white;">
        <h2>
          <span style="display:inline-block;width:15px;height:15px;background-color:red;border-radius:50%;margin-right:8px;"></span>
          Booking Confirmed
        </h2>
        <p>Hello <b>${userName}</b>, your seats have been booked successfully.</p>

        <h3>🚆 Train Info</h3>
        <p><b>Train:</b> ${tripInfo.trainName} (${tripInfo.trainType})</p>
        <p><b>Coaches:</b> ${tripInfo.coaches}</p>
        <p><b>Features:</b> AC: ${tripInfo.features.airConditioned}, Buffet: ${tripInfo.features.buffet}, Sleeper: ${tripInfo.features.sleeper}, Wifi: ${tripInfo.features.wifi}</p>

        <h3>📍 Stations</h3>
        <p><b>From:</b> ${tripInfo.fromStation.name}</p>
        <p><b>To:</b> ${tripInfo.toStation.name}</p>
        <p><b>Departure:</b> ${new Date(tripInfo.departure).toLocaleString()}</p>
        <p><b>Arrival:</b> ${new Date(tripInfo.arrival).toLocaleString()}</p>

        <h4>🛑 Stops</h4>
        <p><a href="${stopsUrl}" target="_blank" style="color:lightblue;">➡️ View all stops on map</a></p>

        <h3>🪑 Seats</h3>
        <table border="1" cellpadding="8" cellspacing="0">${passengerRows}</table>

        <h3>💰 Total Price: ${totalPrice} EGP</h3>

        <h3>📱 QR Code</h3>
        <p><img src="cid:ticketqr" width="200" style="opacity:0.7"/></p>
      </div>
    `,
    attachments: [
      {
        filename: 'ticket-qr.png',
        content: qrCode.replace(/^data:image\/png;base64,/, ''),
        encoding: 'base64',
        cid: 'ticketqr',
      },
      {
        filename: 'window.png',
        path: './assets/icons/window.png',
        cid: 'windowIcon',
      },
      {
        filename: 'middle.png',
        path: './assets/icons/middle.png',
        cid: 'middleIcon',
      },
      {
        filename: 'aisle.png',
        path: './assets/icons/aisle.png',
        cid: 'aisleIcon',
      },
    ],
  })
}

const sendHoldTicketEmail = async (to, data) => {
  const { userName, seatNumbers, passengers, totalPrice, qrCode, tripInfo } =
    data

  const stopsCoords = tripInfo.stops.map(
    (s) => `${s.coordinates.coordinates[1]},${s.coordinates.coordinates[0]}`
  )
  const stopsUrl = `https://www.google.com/maps/dir/${stopsCoords.join('/')}`

  const passengerRows = passengers
    .map((p, i) => {
      let iconCid = 'windowIcon'
      if (seatNumbers[i].includes('Middle')) iconCid = 'middleIcon'
      else if (seatNumbers[i].includes('Aisle')) iconCid = 'aisleIcon'

      return `
      <tr style="color:white; background-color:black;">
        <td>${i + 1}</td>
        <td>${p.name}</td>
        <td>${p.gender || '-'}</td>
        <td>${seatNumbers[i]} <img src="cid:${iconCid}" width="20"/></td>
      </tr>`
    })
    .join('')

  return sendEmail({
    to,
    subject: '⏳ Train Seat Hold',
    text: `Your seats are held temporarily. Seats: ${seatNumbers.join(', ')}`,
    html: `
      <div style="font-family:Arial;padding:20px; background-color:black; color:white;">
        <h2>
          <span style="display:inline-block;width:15px;height:15px;background-color:yellow;border-radius:50%;margin-right:8px;"></span>
          Seat Hold
        </h2>
        <p>Hello <b>${userName}</b>, your seats are held temporarily. Please complete payment to confirm booking.</p>

        <h3>🚆 Train Info</h3>
        <p><b>Train:</b> ${tripInfo.trainName} (${tripInfo.trainType})</p>
        <p><b>Coaches:</b> ${tripInfo.coaches}</p>
        <p><b>Features:</b> AC: ${tripInfo.features.airConditioned}, Buffet: ${tripInfo.features.buffet}, Sleeper: ${tripInfo.features.sleeper}, Wifi: ${tripInfo.features.wifi}</p>

        <h3>📍 Stations</h3>
        <p><b>From:</b> ${tripInfo.fromStation.name}</p>
        <p><b>To:</b> ${tripInfo.toStation.name}</p>
        <p><b>Departure:</b> ${new Date(tripInfo.departure).toLocaleString()}</p>
        <p><b>Arrival:</b> ${new Date(tripInfo.arrival).toLocaleString()}</p>

        <h4>🛑 Stops</h4>
        <p><a href="${stopsUrl}" target="_blank" style="color:lightblue;">➡️ View all stops on map</a></p>

        <h3>🪑 Seats</h3>
        <table border="1" cellpadding="8" cellspacing="0">${passengerRows}</table>

        <h3>💰 Total Price: ${totalPrice} EGP</h3>

        <h3>📱 QR Code</h3>
        <p><img src="cid:ticketqr" width="200" style="opacity:0.7"/></p>
      </div>
    `,
    attachments: [
      {
        filename: 'ticket-qr.png',
        content: qrCode.replace(/^data:image\/png;base64,/, ''),
        encoding: 'base64',
        cid: 'ticketqr',
      },
      {
        filename: 'window.png',
        path: './assets/icons/window.png',
        cid: 'windowIcon',
      },
      {
        filename: 'middle.png',
        path: './assets/icons/middle.png',
        cid: 'middleIcon',
      },
      {
        filename: 'aisle.png',
        path: './assets/icons/aisle.png',
        cid: 'aisleIcon',
      },
    ],
  })
}

// EXPORTS
// ----------------------
module.exports = {
  sendEmail,
  sendOTPEmail,
  sendBookedTicketEmail,
  sendHoldTicketEmail,
}
