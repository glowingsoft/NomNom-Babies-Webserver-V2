const { GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { s3 } = require("@utils/s3Client");

const SIGNED_URL_TTL_SECONDS = 300;
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,200}$/;

const getMedia = async (req, res) => {
  const { key } = req.params;

  if (!KEY_PATTERN.test(key)) {
    return res.status(400).json({ message: "Invalid file key" });
  }

  try {
    const url = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: process.env.S3_BUCKET_NAME,
        Key: key,
      }),
      { expiresIn: SIGNED_URL_TTL_SECONDS },
    );

    res.set("Cross-Origin-Resource-Policy", "cross-origin");
    res.set("Cache-Control", `private, max-age=${SIGNED_URL_TTL_SECONDS - 60}`);
    return res.redirect(302, url);
  } catch (error) {
    return res.status(500).json({ message: "Unable to load file" });
  }
};

module.exports = { getMedia };
