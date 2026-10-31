const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const validator = require("validator");
const { User } = require("@models/UserModel");
const { sendResponse, validateParams } = require("@utils/responseUtil");
const { sendEmailViaSgrid } = require("@utils/emailUtil");
const {
  accountDeletionOtpEmailTemplate,
  accountDeletedEmailTemplate,
} = require("@utils/emailTemplates");
const { hardDeleteUserById, DELETED_STATUS } = require("@utils/hardDeleteUser");
const { logActivity } = require("@utils/activityUtil");

/**
 * Web account deletion (Play Store / App Store "delete account" URL), no sign-in needed:
 * 1. request  {email}                    → emails a 6-digit code, returns a random requestId
 * 2. verify   {email, otp, requestId}    → returns a 10-minute deletion token
 * 3. confirm  {requestId, deletionToken} → deletes the account and emails a confirmation
 * The requestId is only ever returned to the browser that started the request (kept in its session storage, never
 * emailed), so all three steps have to happen in that same browser.
 */

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const TOKEN_PURPOSE = "account-deletion";

const sha256 = (value) =>
  crypto.createHash("sha256").update(String(value)).digest("hex");
const exposeOtp = (otp) => (process.env.NODE_ENV === "prod" ? {} : { otp });

const findActiveUser = (email) =>
  User.findOne({
    email: String(email).trim().toLowerCase(),
    "accountState.status": { $ne: DELETED_STATUS },
  });

const requestDeletion = async (req, res) => {
  if (!validateParams(req, res, { rawData: ["email"] })) return;
  const { email } = req.body;
  if (!validator.isEmail(String(email).trim())) {
    return sendResponse({ res, statusCode: 400, translationKey: "email_invalid" });
  }

  try {
    const user = await findActiveUser(email);
    if (!user) {
      return sendResponse({ res, statusCode: 404, translationKey: "user_not_found" });
    }

    const otp = String(crypto.randomInt(100000, 1000000));
    const requestId = crypto.randomBytes(24).toString("hex");
    user.deletionRequest = {
      requestId: sha256(requestId),
      otpHash: sha256(otp),
      expiresAt: new Date(Date.now() + OTP_TTL_MS),
      attempts: 0,
    };
    await user.save();

    await sendEmailViaSgrid(
      "NomNom Babies",
      [user.email],
      "Confirm your NomNom Babies account deletion",
      accountDeletionOtpEmailTemplate(otp),
    ).catch((error) =>
      console.error("Deletion OTP email failed:", error?.response?.body || error.message),
    );

    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "deletion_code_sent",
      data: { requestId, expiresIn: OTP_TTL_MS / 1000, ...exposeOtp(otp) },
    });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, translationKey: "internal_server", error });
  }
};

const verifyDeletion = async (req, res) => {
  if (!validateParams(req, res, { rawData: ["email", "otp", "requestId"] })) return;
  const { email, otp, requestId } = req.body;

  try {
    const user = await findActiveUser(email);
    const pending = user?.deletionRequest;
    if (!pending?.requestId || pending.requestId !== sha256(requestId)) {
      return sendResponse({ res, statusCode: 400, translationKey: "deletion_request_invalid" });
    }
    if (pending.expiresAt < new Date() || pending.attempts >= MAX_ATTEMPTS) {
      return sendResponse({ res, statusCode: 400, translationKey: "deletion_code_expired" });
    }
    if (pending.otpHash !== sha256(otp)) {
      user.deletionRequest.attempts += 1;
      await user.save();
      return sendResponse({ res, statusCode: 400, translationKey: "invalid_otp" });
    }

    const deletionToken = jwt.sign(
      { sub: String(user._id), rid: sha256(requestId), purpose: TOKEN_PURPOSE },
      process.env.JWT_SECRET,
      { expiresIn: "10m" },
    );
    return sendResponse({
      res,
      statusCode: 200,
      translationKey: "otp_verified",
      data: { deletionToken, email: user.email },
    });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, translationKey: "internal_server", error });
  }
};

const confirmDeletion = async (req, res) => {
  if (!validateParams(req, res, { rawData: ["requestId", "deletionToken"] })) return;
  const { requestId, deletionToken } = req.body;

  let payload;
  try {
    payload = jwt.verify(deletionToken, process.env.JWT_SECRET);
  } catch {
    return sendResponse({ res, statusCode: 401, translationKey: "deletion_code_expired" });
  }
  if (payload.purpose !== TOKEN_PURPOSE || payload.rid !== sha256(requestId)) {
    return sendResponse({ res, statusCode: 401, translationKey: "deletion_request_invalid" });
  }

  try {
    const user = await User.findById(payload.sub).select("email deletionRequest accountState");
    // The request must still be the latest one for this account (a newer request invalidates older tokens).
    if (!user || user.deletionRequest?.requestId !== payload.rid) {
      return sendResponse({ res, statusCode: 400, translationKey: "deletion_request_invalid" });
    }
    const email = user.email;

    await hardDeleteUserById(user._id);
    await User.updateOne({ _id: user._id }, { $unset: { deletionRequest: 1 } });

    logActivity({
      user: user._id,
      userType: user.accountState?.userType || "user",
      action: "Account Deleted",
      detail: `${email} deleted their account from the website`,
      module: "auth",
      targetId: user._id,
    });

    sendEmailViaSgrid(
      "NomNom Babies",
      [email],
      "Your NomNom Babies account has been deleted",
      accountDeletedEmailTemplate(),
    ).catch(() => {});

    return sendResponse({ res, statusCode: 200, translationKey: "account_deleted" });
  } catch (error) {
    return sendResponse({ res, statusCode: 500, translationKey: "internal_server", error });
  }
};

module.exports = { requestDeletion, verifyDeletion, confirmDeletion };
