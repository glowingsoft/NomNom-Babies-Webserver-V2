const fs = require("fs");
const path = require("path");

const savePdf = async (buffer, filename) => {
  const folder = path.join(process.cwd(), "uploads", "pdfs");

  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }

  const filePath = path.join(folder, filename);

  fs.writeFileSync(filePath, buffer);

  return `/uploads/pdfs/${filename}`;
};

module.exports = { savePdf };
