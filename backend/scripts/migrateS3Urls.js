require("dotenv").config({ path: require("path").join(__dirname, "../../.env") });
const mongoose = require("mongoose");

const FROM = process.env.OLD_S3_BASE_URL;
const TO = process.env.S3_BASE_URL;
const apply = process.argv.includes("--apply");

if (!FROM || !TO || FROM === TO) {
  console.error("Set OLD_S3_BASE_URL (direct S3 URL) and S3_BASE_URL (new media URL) first.");
  process.exit(1);
}

const rewrite = (value) => {
  if (typeof value === "string") {
    return value.startsWith(FROM) ? TO + value.slice(FROM.length) : value;
  }
  if (Array.isArray(value)) return value.map(rewrite);
  if (value && value.constructor === Object) {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = rewrite(v);
    return out;
  }
  return value;
};

(async () => {
  await mongoose.connect(process.env.BASE_URL);
  const collections = await mongoose.connection.db.listCollections().toArray();
  let changed = 0;

  for (const { name } of collections) {
    const col = mongoose.connection.db.collection(name);
    const cursor = col.find({});
    for await (const doc of cursor) {
      const { _id, ...rest } = doc;
      const updated = rewrite(rest);
      if (JSON.stringify(updated) === JSON.stringify(rest)) continue;
      changed++;
      console.log(`${apply ? "updating" : "would update"} ${name}/${_id}`);
      if (apply) await col.updateOne({ _id }, { $set: updated });
    }
  }

  console.log(`${apply ? "Updated" : "Would update"} ${changed} documents.`);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
