/**
 * Counts documents per status in ONE query, for the tab badges of admin list APIs.
 * Counts ignore pagination, search and the status filter, so every tab always shows its total.
 *
 * @param {import("mongoose").Model} Model
 * @param {object} options
 * @param {string[]} options.statuses - every status to report (missing ones are returned as 0)
 * @param {string} [options.path="status"] - field that holds the status
 * @param {string} [options.defaultStatus] - status of documents that don't store the field (schema default)
 * @param {object} [options.booleanMap] - for boolean fields: { true: "active", false: "inactive" }
 * @param {boolean} [options.booleanDefault=true] - value assumed when the boolean field is missing
 * @param {object} [options.match={}] - documents to count
 * @returns {Promise<object>} { all, <status>: n, ... }
 */
const statusCounts = async (
  Model,
  {
    statuses,
    path = "status",
    defaultStatus,
    booleanMap,
    booleanDefault = true,
    match = {},
  },
) => {
  let fallback = null;
  if (booleanMap) fallback = booleanDefault;
  else if (defaultStatus !== undefined) fallback = defaultStatus;

  const rows = await Model.aggregate([
    { $match: match },
    {
      $group: {
        _id:
          fallback === null
            ? `$${path}`
            : { $ifNull: [`$${path}`, fallback] },
        count: { $sum: 1 },
      },
    },
  ]);

  const counts = Object.fromEntries(statuses.map((status) => [status, 0]));
  let all = 0;

  rows.forEach(({ _id, count }) => {
    all += count;

    const key = booleanMap ? booleanMap[String(_id)] : _id;

    if (key !== undefined && key in counts) {
      counts[key] += count;
    }
  });

  return { all, ...counts };
};

module.exports = { statusCounts };
