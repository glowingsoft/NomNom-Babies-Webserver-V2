
/**
 * Turns a stored image reference into a full URL. Absolute URLs are returned as-is; bare keys
 * (`abc.png`) are joined to S3_BASE_URL with exactly one "/" between them.
 */
function getFullImageUrl(imagePath, baseUrl = process.env.S3_BASE_URL || "") {
  const base = baseUrl.replace(/\/+$/, "");
  if (imagePath && !imagePath.startsWith("http")) {
    return `${base}/${imagePath.replace(/^\/+/, "")}`;
  }
  return imagePath || `${base}/noimage.png`;
}

module.exports = { getFullImageUrl };
