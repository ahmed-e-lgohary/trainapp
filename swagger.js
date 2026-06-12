const swaggerUi = require("swagger-ui-express");

const swaggerSpec = {
  openapi: "3.0.0",
  info: {
    title: "Train Booking API Documentation",
    version: "1.0.0",
    description: "Comprehensive API documentation for the Train Booking System backend",
  },
  servers: [
    {
      url: "http://localhost:5000",
      description: "Local Development Server",
    },
    {
      url: "https://trainapp-production-8bab.up.railway.app",
      description: "Production Server",
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
      },
    },
  },
  security: [
    {
      bearerAuth: [],
    },
  ],
  paths: {
    // ==========================================
    // AUTHENTICATION & ACCOUNT
    // ==========================================
    "/api/v1/email/signup": {
      post: {
        summary: "Register a new user",
        tags: ["Authentication"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password", "confirmPassword", "name", "phone"],
                properties: {
                  email: { type: "string" },
                  password: { type: "string" },
                  confirmPassword: { type: "string" },
                  name: { type: "string" },
                  phone: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Signup success, verification code sent." } },
      },
    },
    "/api/v1/email/verifyOTP": {
      post: {
        summary: "Verify signup OTP",
        tags: ["Authentication"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "otp", "type"],
                properties: {
                  email: { type: "string" },
                  otp: { type: "string" },
                  type: { type: "string", enum: ["signup", "reset"] },
                },
              },
            },
          },
        },
        responses: { 200: { description: "OTP verified successfully." } },
      },
    },
    "/api/v1/email/resend-otp": {
      post: {
        summary: "Resend verification OTP",
        tags: ["Authentication"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "type"],
                properties: { 
                  email: { type: "string" },
                  type: { type: "string", enum: ["signup", "reset"] },
                },
              },
            },
          },
        },
        responses: { 200: { description: "OTP resent successfully." } },
      },
    },
    "/api/v1/email/login": {
      post: {
        summary: "Login with email & password",
        tags: ["Authentication"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password"],
                properties: {
                  email: { type: "string" },
                  password: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Login successful. Returns token and user object." } },
      },
    },
    "/api/v1/email/login/google": {
      post: {
        summary: "Login/Signup with Google OAuth token",
        tags: ["Authentication"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["token"],
                properties: { token: { type: "string" } },
              },
            },
          },
        },
        responses: { 200: { description: "Google Login successful." } },
      },
    },
    "/api/v1/email/login/facebook": {
      post: {
        summary: "Login/Signup with Facebook access token",
        tags: ["Authentication"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["accessToken"],
                properties: { accessToken: { type: "string" } },
              },
            },
          },
        },
        responses: { 200: { description: "Facebook Login successful." } },
      },
    },
    "/api/v1/email/forgot-password": {
      post: {
        summary: "Request password reset OTP",
        tags: ["Authentication"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email"],
                properties: { email: { type: "string" } },
              },
            },
          },
        },
        responses: { 200: { description: "Password reset OTP sent." } },
      },
    },
    "/api/v1/email/reset-password": {
      post: {
        summary: "Reset password with OTP",
        tags: ["Authentication"],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "otp", "newPassword"],
                properties: {
                  email: { type: "string" },
                  otp: { type: "string" },
                  newPassword: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Password reset successful." } },
      },
    },
    "/api/v1/email/UserCreate/admin": {
      post: {
        summary: "Create a user directly (Admin only)",
        tags: ["Authentication"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["email", "password", "confirmPassword", "name", "phone", "role"],
                properties: {
                  email: { type: "string" },
                  password: { type: "string" },
                  confirmPassword: { type: "string" },
                  name: { type: "string" },
                  phone: { type: "string" },
                  role: { type: "string", enum: ["user", "admin", "commissary"] },
                },
              },
            },
          },
        },
        responses: { 200: { description: "User created by admin successfully." } },
      },
    },
    "/api/v1/email/account": {
      get: {
        summary: "Get current user profile",
        tags: ["Profile"],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Profile data fetched successfully." } },
      },
      put: {
        summary: "Update current user profile",
        tags: ["Profile"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  name: { type: "string" },
                  email: { type: "string" },
                  phone: { type: "string" },
                  password: { type: "string" },
                  NationalId: { type: "string" },
                  country: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Profile updated successfully." } },
      },
      delete: {
        summary: "Delete current user account",
        tags: ["Profile"],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Account deleted successfully." } },
      },
    },

    // ==========================================
    // USERS, BOOKINGS & SEARCH
    // ==========================================
    "/api/v1/users/trips/search": {
      get: {
        summary: "Search trips by station and date",
        tags: ["Bookings & Trips (User)"],
        parameters: [
          { name: "from", in: "query", required: true, schema: { type: "string" } },
          { name: "to", in: "query", required: true, schema: { type: "string" } },
          { name: "date", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Trips list fetched successfully." } },
      },
    },
    "/api/v1/users/trips/{tripId}/route": {
      get: {
        summary: "Get intermediate stops and times of a trip",
        tags: ["Bookings & Trips (User)"],
        parameters: [
          { name: "tripId", in: "path", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Stops list fetched successfully." } },
      },
    },
    "/api/v1/users/stations": {
      get: {
        summary: "Get all active stations across Egypt",
        tags: ["Bookings & Trips (User)"],
        responses: { 200: { description: "Stations list." } },
      },
    },
    "/api/v1/users/destinations": {
      get: {
        summary: "Get available destinations from a specific station",
        tags: ["Bookings & Trips (User)"],
        parameters: [
          { name: "from", in: "query", required: true, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Destinations list." } },
      },
    },
    "/api/v1/users/trips/{tripId}/seats": {
      get: {
        summary: "Get seats layout and availability for a trip",
        tags: ["Bookings & Trips (User)"],
        parameters: [
          { name: "tripId", in: "path", required: true, schema: { type: "string" } },
          { name: "from", in: "query", required: false, schema: { type: "string" } },
          { name: "to", in: "query", required: false, schema: { type: "string" } },
        ],
        responses: { 200: { description: "Seats layout." } },
      },
    },
    "/api/v1/users/seats/{seatId}/hold": {
      post: {
        summary: "Hold/Reserve seats with passenger details",
        tags: ["Bookings & Trips (User)"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "seatId", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["tripId", "passengers"],
                properties: {
                  tripId: { type: "string" },
                  action: { type: "string", default: "hold" },
                  from: { type: "string" },
                  to: { type: "string" },
                  passengers: {
                    type: "array",
                    items: {
                      type: "object",
                      required: ["seatId", "fullName", "phone", "nationalId"],
                      properties: {
                        seatId: { type: "string" },
                        fullName: { type: "string" },
                        phone: { type: "string" },
                        nationalId: { type: "string" },
                        profileType: { type: "string", default: "Adult" },
                        nationality: { type: "string", default: "Egyptian" },
                        gender: { type: "string", enum: ["male", "female"] },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Seats successfully held." } },
      },
    },
    "/api/v1/users/bookings": {
      post: {
        summary: "Get user bookings history",
        tags: ["Bookings & Trips (User)"],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "User bookings fetched." } },
      },
    },
    "/api/v1/users/bookings/{id}": {
      delete: {
        summary: "Cancel a passenger's seat or entire booking",
        tags: ["Bookings & Trips (User)"],
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: "id", in: "path", required: true, schema: { type: "string" } },
        ],
        requestBody: {
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: {
                  bookingCode: { type: "string" },
                  email: { type: "string" },
                  phone: { type: "string" },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Booking/Seat cancelled successfully." } },
      },
    },
    "/api/v1/users/updateAllTrips": {
      post: {
        summary: "Update all trips departure dates starting from today",
        tags: ["System Operations"],
        responses: { 200: { description: "All trips dates updated." } },
      },
    },
    "/api/v1/users/diversifyTrips": {
      post: {
        summary: "Rebuild and diversify seats with random trains",
        tags: ["System Operations"],
        responses: { 200: { description: "Trips seats rebuilt." } },
      },
    },

    // ==========================================
    // STAFF & COMMISSARY
    // ==========================================
    "/api/v1/commissary/verify-qr": {
      post: {
        summary: "Verify ticket QR code at station (Staff/Admin only)",
        tags: ["Staff / Commissary"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["qrCodeText"],
                properties: { qrCodeText: { type: "string" } },
              },
            },
          },
        },
        responses: { 200: { description: "Ticket verification result." } },
      },
    },

    // ==========================================
    // ADMIN DASHBOARD
    // ==========================================
    "/api/v1/admin/trains": {
      get: {
        summary: "Get all trains",
        tags: ["Admin / Trains"],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "All trains fetched." } },
      },
      post: {
        summary: "Bulk create trains",
        tags: ["Admin / Trains"],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Trains created." } },
      },
      delete: {
        summary: "Delete all trains",
        tags: ["Admin / Trains"],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "All trains deleted." } },
      },
    },
    "/api/v1/admin/train": {
      post: {
        summary: "Create a single train",
        tags: ["Admin / Trains"],
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["name", "number", "type"],
                properties: {
                  name: { type: "string" },
                  number: { type: "string" },
                  type: { type: "string", enum: ["Talgo", "Spanish", "French", "VIP", "Russian"] },
                },
              },
            },
          },
        },
        responses: { 200: { description: "Train created." } },
      },
    },
    "/api/v1/admin/train/{id}": {
      get: {
        summary: "Get train by ID",
        tags: ["Admin / Trains"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Train details." } },
      },
      put: {
        summary: "Update train by ID",
        tags: ["Admin / Trains"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Train updated." } },
      },
      delete: {
        summary: "Delete train by ID",
        tags: ["Admin / Trains"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Train deleted." } },
      },
    },
    "/api/v1/admin/trips": {
      get: {
        summary: "Get all trips",
        tags: ["Admin / Trips"],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "All trips fetched." } },
      },
      post: {
        summary: "Bulk create trips with stops",
        tags: ["Admin / Trips"],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Trips created." } },
      },
      delete: {
        summary: "Delete all trips",
        tags: ["Admin / Trips"],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "All trips deleted." } },
      },
    },
    "/api/v1/admin/trip": {
      post: {
        summary: "Create a single trip",
        tags: ["Admin / Trips"],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Trip created." } },
      },
    },
    "/api/v1/admin/trip/{id}": {
      get: {
        summary: "Get trip details by ID",
        tags: ["Admin / Trips"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Trip details." } },
      },
      put: {
        summary: "Update trip details by ID",
        tags: ["Admin / Trips"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Trip updated." } },
      },
      delete: {
        summary: "Delete trip by ID",
        tags: ["Admin / Trips"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Trip deleted." } },
      },
    },
    "/api/v1/admin/trip-route/{tripId}": {
      get: {
        summary: "Get trip stops/routes by trip ID",
        tags: ["Admin / Trips"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "tripId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Trip route." } },
      },
    },
    "/api/v1/admin/stations": {
      get: {
        summary: "Get all stations",
        tags: ["Admin / Stations"],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "All stations." } },
      },
      post: {
        summary: "Bulk create stations",
        tags: ["Admin / Stations"],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Stations created." } },
      },
      delete: {
        summary: "Delete all stations",
        tags: ["Admin / Stations"],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "All stations deleted." } },
      },
    },
    "/api/v1/admin/station": {
      post: {
        summary: "Create a single station",
        tags: ["Admin / Stations"],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Station created." } },
      },
    },
    "/api/v1/admin/station/{id}": {
      get: {
        summary: "Get station by ID",
        tags: ["Admin / Stations"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Station details." } },
      },
      put: {
        summary: "Update station by ID",
        tags: ["Admin / Stations"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Station updated." } },
      },
      delete: {
        summary: "Delete station by ID",
        tags: ["Admin / Stations"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Station deleted." } },
      },
    },
    "/api/v1/admin/seats": {
      post: {
        summary: "Admin manage and rebuild physical seats",
        tags: ["Admin / Seats"],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Seats generated." } },
      },
    },
    "/api/v1/admin/seats/trip/{tripId}": {
      get: {
        summary: "Get all seats of a trip by trip ID",
        tags: ["Admin / Seats"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "tripId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Seats list." } },
      },
    },
    "/api/v1/admin/trains/{trainId}/seats": {
      get: {
        summary: "Get all seats of a train by train ID",
        tags: ["Admin / Seats"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "trainId", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Seats list." } },
      },
    },
    "/api/v1/admin/seat/{id}": {
      put: {
        summary: "Update seat by ID",
        tags: ["Admin / Seats"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Seat updated." } },
      },
      delete: {
        summary: "Delete seat by ID",
        tags: ["Admin / Seats"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "Seat deleted." } },
      },
    },
    "/api/v1/admin/users": {
      get: {
        summary: "Get all registered users list",
        tags: ["Admin / Users"],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "All users list." } },
      },
    },
    "/api/v1/admin/users/{id}": {
      delete: {
        summary: "Delete a user by ID",
        tags: ["Admin / Users"],
        security: [{ bearerAuth: [] }],
        parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }],
        responses: { 200: { description: "User deleted." } },
      },
    },
    "/api/v1/admin/database/freeup": {
      delete: {
        summary: "Reset and free up database collections",
        tags: ["Admin / System"],
        security: [{ bearerAuth: [] }],
        responses: { 200: { description: "Database collections freed up." } },
      },
    },
  },
};

module.exports = {
  swaggerUi,
  swaggerSpec,
};
