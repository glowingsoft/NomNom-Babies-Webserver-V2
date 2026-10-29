const fs = require("fs");
const path = require("path");
const admin = require("firebase-admin");

/**
 * Firebase Admin (push notifications) is configured from one file: the service-account JSON downloaded from
 * Firebase › Project settings › Service accounts › Generate new private key.
 * FIREBASE_SERVICE_ACCOUNT_PATH points to it, relative to the project root (e.g. secrets/firebase-service-account.json).
 */
const file = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
const fullPath = file ? path.resolve(process.cwd(), file) : null;

if (!fullPath || !fs.existsSync(fullPath)) {
  console.warn(
    `Firebase Admin skipped — service account not found (FIREBASE_SERVICE_ACCOUNT_PATH=${file || "unset"}).`,
  );
} else if (!admin.apps.length) {
  const serviceAccount = JSON.parse(fs.readFileSync(fullPath, "utf8"));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  console.log(`Firebase Admin initialized (${serviceAccount.project_id})`);
}

module.exports = admin;
