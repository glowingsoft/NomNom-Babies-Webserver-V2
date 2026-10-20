const path = require("path");
const { S3Client, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { Upload } = require("@aws-sdk/lib-storage");
const multer = require("multer");
const { sendResponse } = require("@utils/responseUtil");
const { v4: uuidv4 } = require("uuid");
const { values } = require("lodash");
require("dotenv").config();
const { uploads3Mw } = require("@middlewares/uploadFilesAWSMw");
const sharp = require("sharp");
const { send } = require("process");
let pLimit;
(async () => {
  pLimit = (await import("p-limit")).default;
})();

const MAX_FILE_SIZE = 3 * 1024 * 1024;

const uploadFiles = (req, res) => {
  uploads3Mw(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_COUNT") {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey: "limit_exceeding_max_files",
          error: "Too many files",
        });
      }
      if (err.code === "LIMIT_UNEXPECTED_FILE") {
        return sendResponse({
          res,
          statusCode: 400,
          translationKey: "limit_exceeding_max_files",
          error: err.message,
        });
      }
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "file_upload",
        values: {
          errorMessage: err.message,
        },
        error: err,
      });
    } else if (err) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "file_upload",
        values: {
          errorMessage: err.message,
        },
        error: err,
      });
    } else if (!req.files || req.files.length === 0) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "no_files",
      });
    }

    try {
      const uploadedFiles = await uploadFilesToS3(req.files);

      const response =
        uploadedFiles.length === 1 ? uploadedFiles[0] : uploadedFiles;

      return sendResponse({
        res,
        statusCode: 200,
        translationKey: "files_uploaded",
        data: response,
      });
    } catch (error) {
      return sendResponse({
        res,
        statusCode: 500,
        translationKey: "s3_upload",
        values: {
          error: error.message,
        },
        error: error,
      });
    }
  });
};

const s3 = new S3Client({
  region: process.env.AWS_S3_REGION,
  credentials: {
    accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
  },
});

const uploadFilesToS3 = async (files) => {
  const limit = pLimit(5);

  const uploadPromises = files.map((file, index) => 
    limit(async () => {

      let fileBuffer = file.buffer;

      const params = createUploadParams({ ...file, buffer: fileBuffer });
      const parallelUploads3 = new Upload({
        client: s3,
        params: params,
      });

      parallelUploads3.on("httpUploadProgress", (progress) => {
      });

      await parallelUploads3.done();

      console.log(`Remaining files: ${files.length - (index + 1)}`);

      return {
        file: params.Key,
        fileUrl: `${process.env.S3_BASE_URL}/${params.Key}`,
        fileExtension: path.extname(params.Key),
      };
    })
  );

  return Promise.all(uploadPromises);
};

const createUploadParams = (file) => {
  const fileExtension = path.extname(file.originalname);
  const filename = `${uuidv4()}${fileExtension}`;

  if (!file.buffer) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: "file_buffer",
      error: "File buffer is missing",
    });
  }

  return {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: filename,
    Body: file.buffer,
    ContentType: file.mimetype,
    ACL: "public-read-write",
  };
};

const compressImage = async (buffer) => {
  let quality = 80;
  let compressedBuffer = buffer;

  do {
    compressedBuffer = await sharp(buffer)
      .jpeg({ quality })
      .toBuffer();

    if (compressedBuffer.length <= MAX_FILE_SIZE) {
      break;
    }
    console.log(`Compressed image size: ${compressedBuffer.length} bytes`);

    quality -= 10;

    if (quality < 10) {
      return sendResponse({
        res,
        statusCode: 400,
        translationKey: "image_size_compress",
        error: "Unable to compress image below 3 MB",
      });
    }
  } while (compressedBuffer.length > MAX_FILE_SIZE);

  return compressedBuffer;
};

const deleteFileFromS3 = async (fileKey) => {
  const params = {
    Bucket: process.env.S3_BUCKET_NAME,
    Key: fileKey,
  };

  try {
    const data = await s3.send(new DeleteObjectCommand(params));
    return data;
  } catch (error) {
    throw new Error(`Failed to delete file: ${error.message}`);
  }
};

const deleteMultipleFilesFromS3 = async (fileKeys) => {
  const deletePromises = fileKeys.map((fileKey) => deleteFileFromS3(fileKey));
  try {
    await Promise.all(deletePromises);
  } catch (error) {
    throw new Error(`Failed to delete some files: ${error.message}`);
  }
};

const deleteFiles = async (req, res) => {
  const { fileKey } = req.body;

  if (!fileKey) {
    return sendResponse({
      res,
      statusCode: 400,
      translationKey: "file_key",
      error: "File key is missing.",
    });
  }

  try {
    if (Array.isArray(fileKey)) {
      await deleteMultipleFilesFromS3(fileKey);
      return sendResponse({
        res,
        statusCode: 200,
        translationKey: "files_deleted",
        data: { fileKeys: fileKey },
      });
    } else {
      await deleteFileFromS3(fileKey);
      return sendResponse({
        res,
        statusCode: 200,
        translationKey: "file_deleted",
        data: { fileKey },
      });
    }
  } catch (error) {
    return sendResponse({
      res,
      statusCode: 500,
      translationKey: "file_deletion",
      error: error,
    });
  }
};
module.exports = {
  uploadFiles,
  deleteFiles,
};
