const fs = require("fs");
const path = require("path");
const mime = require("mime-types");
const upload = require("../../middlewares/uploadFileMw");
const { sendResponse } = require("@utils/responseUtil");

// Same folder multer writes to (destination "./uploads/" relative to the process cwd).
const UPLOAD_DIR = path.join(process.cwd(), "uploads");

const getFileType = (mimeType) => {
  if (mimeType.startsWith("image/")) {
    return "image";
  } else if (mimeType.startsWith("video/")) {
    return "video";
  } else {
    return "document";
  }
};

const uploadFile = (req, res) => {
  upload(req, res, (err) => {
    if (err) {
      sendResponse({
        res,
        statusCode: 400,
        translationKey: "file_upload_1",
        error: err,
      });
    } else {
      if (req.file == undefined) {
        sendResponse({
          res,
          statusCode: 400,
          translationKey: "no_file",
        });
      } else {
        // Local disk storage: served by GET /api/upload/:filename (S3_BASE_URL only serves S3 objects).
        const baseUrl = `${req.protocol}://${req.get("host")}/api/upload/`;

        sendResponse({
          res,
          statusCode: 200,
          translationKey: "file_uploaded",
          data: {
            message: "File uploaded successfully!",
            file: `${req.file.filename}`,
            fileUrl: `${baseUrl}${req.file.filename}`,
          },
        });
      }
    }
  });
};

const getFileByName = (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(UPLOAD_DIR, filename);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      sendResponse({
        res,
        statusCode: 404,
        translationKey: "file_not",
        error: "File not found",
      });
    } else {
      res.sendFile(filePath);
    }
  });
};

const getFileDetails = (req, res) => {
  const filename = req.params.filename;
  const filePath = path.join(UPLOAD_DIR, filename);

  fs.access(filePath, fs.constants.F_OK, (err) => {
    if (err) {
      sendResponse({
        res,
        statusCode: 404,
        translationKey: "file_not",
        error: "File not found",
      });
    } else {
      const mimeType = mime.lookup(filePath);
      const fileType = getFileType(mimeType);

      const urlPath = `${req.protocol}://${req.get("host")}/api/upload/${filename}`;

      const fileDetails = {
        filename,
        path: urlPath,
        mimeType,
        fileType,
      };

      sendResponse({
        res,
        statusCode: 200,
        translationKey: "file_details",
        data: fileDetails,
      });
    }
  });
};

const getAllFiles = (req, res) => {
  const directoryPath = UPLOAD_DIR;

  fs.readdir(directoryPath, (err, files) => {
    if (err) {
      sendResponse({
        res,
        statusCode: 500,
        translationKey: "unable_to",
        error: "Unable to scan files",
      });
    } else {
      const fileDetails = files.map((file) => {
        const filePath = path.join(directoryPath, file);
        const mimeType = mime.lookup(filePath);
        const fileType = getFileType(mimeType);

        const urlPath = `${req.protocol}://${req.get("host")}/api/upload/${file}`;

        return {
          filename: file,
          path: urlPath,
          mimeType,
          fileType,
        };
      });

      sendResponse({
        res,
        statusCode: 200,
        translationKey: "all_files",
        data: { files: fileDetails },
      });
    }
  });
};

module.exports = {
  uploadFile,
  getFileByName,
  getFileDetails,
  getAllFiles,
};
