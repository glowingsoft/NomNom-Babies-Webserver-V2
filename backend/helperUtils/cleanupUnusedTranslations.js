const fs = require("fs");
const path = require("path");

const controllersDir = path.join(__dirname, "../controllers");
const enJsonPath = path.join(__dirname, "../assets/locales/en.json");

const getTranslationKeysFromControllers = () => {
  const translationKeys = new Set();
  
  const files = fs.readdirSync(controllersDir);
  
  files.forEach((file) => {
    const filePath = path.join(controllersDir, file);
    
    if (filePath.endsWith(".js")) {
      const content = fs.readFileSync(filePath, "utf-8");

      const regex = /translationKey:\s*"(.*?)"/g;
      let match;

      while ((match = regex.exec(content)) !== null) {
        translationKeys.add(match[1]);
      }
    }
  });

  return translationKeys;
};

const updateEnJsonFile = (usedKeys) => {
  const enJson = JSON.parse(fs.readFileSync(enJsonPath, "utf-8"));

  Object.keys(enJson).forEach((key) => {
    if (!usedKeys.has(key)) {
      delete enJson[key];
    }
  });

  fs.writeFileSync(enJsonPath, JSON.stringify(enJson, null, 2), "utf-8");

  console.log("en.json updated with only the used translation keys.");
};

const cleanUpTranslationKeys = () => {
  console.log("Fetching translation keys used in controllers...");

  const usedTranslationKeys = getTranslationKeysFromControllers();

  console.log("Found the following used translation keys:");
  console.log(usedTranslationKeys);

  updateEnJsonFile(usedTranslationKeys);
};

cleanUpTranslationKeys();
