const multer = require("multer");

const storage = multer.memoryStorage();

const uploads3Mw = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    checkFileType(file, cb);
  },
}).array("files", 20);

function checkFileType(file, cb) {
  const filetypes = /jpeg|jpg|png|gif|bmp|tiff|webp/;
  const extname = filetypes.test(
    file.originalname.toLowerCase()
  );
  const mimetype = filetypes.test(file.mimetype);

  if (extname && mimetype) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type. Only images are allowed!"));
  }
}

module.exports = {
  uploads3Mw,
};
