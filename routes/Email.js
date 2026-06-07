const express = require("express");
const router = express.Router();
const EmailController = require("../controllers/Email");
const { authMiddleware, authorizeRole } = require("../middleware/auth");
router.post(
  "/UserCreate/admin",
  authMiddleware,
  authorizeRole(["admin"]),
  EmailController.signupByAdmin,
);

/**
 * @openapi
 * /api/v1/email/signup:
 *   post:
 *     summary: Register a new user and send verification OTP
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *               - name
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               name:
 *                 type: string
 *     responses:
 *       200:
 *         description: Signup successful, OTP sent to email.
 */
router.post("/signup", EmailController.signup);

/**
 * @openapi
 * /api/v1/email/verifyOTP:
 *   post:
 *     summary: Verify email OTP
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - otp
 *             properties:
 *               email:
 *                 type: string
 *               otp:
 *                 type: string
 *     responses:
 *       200:
 *         description: OTP verified successfully.
 */
router.post("/verifyOTP", EmailController.verifyOTP);
router.post("/resend-otp", EmailController.resendOTP);

/**
 * @openapi
 * /api/v1/email/login:
 *   post:
 *     summary: User login
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful. Returns JWT token.
 */
router.post("/login", EmailController.login);
router.post("/login/google", EmailController.loginWithGoogle);
router.post("/login/facebook", EmailController.loginWithFacebook);
router.post("/forgot-password", EmailController.forgotPassword);
router.post("/reset-password", EmailController.resetPassword);
router.get("/account", authMiddleware, EmailController.getAccount);
router.put("/account", authMiddleware, EmailController.updateAccount);
router.delete("/account", authMiddleware, EmailController.deleteAccount);

module.exports = router;

//----------------------
//! NumberOfRoutes :- 12
//----------------------
//? signup
//? verifyEmail
//? resendOTP
//? login
//? forgotPassword
//? resetPassword
//? getAccount
//? updateAccount
//? deleteAccount
//? loginWithGoogle
//? loginWithFacebook
//? verifyResetOTP
//----------------------
