const path = require("path");
const sharp = require("sharp");

const LOGO_FILE = path.join(__dirname, "../../assets/favicon/favicon.png");

let cached = null;

const getLogo = () => {
  if (!cached) {
    cached = sharp(LOGO_FILE)
      .resize({ width: 240 })
      .png({ palette: true, quality: 90 })
      .toBuffer()
      .catch(() => null);
  }
  return cached;
};

module.exports = { getLogo };
