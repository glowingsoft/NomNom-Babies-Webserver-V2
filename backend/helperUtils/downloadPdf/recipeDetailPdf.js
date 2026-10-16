const PDFDocument = require("pdfkit");

const {
  PRIMARY,
  DARK,
  GRAY,
  MARGIN,
  CONTENT_WIDTH,
  FONT_SIZES,
} = require("./constants");

const { drawHeader, ensureSpace, sectionTitle, infoCard } = require("./layout");
const { chipRow, drawDivider } = require("./helpers");

const generateRecipePdf = (recipe) => {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: MARGIN });

    const buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));

    drawHeader(doc, recipe.title);

    doc.moveDown();

    infoCard(doc, [
      ["Meal Type", recipe.mealType],
      ["Prep Time", recipe.prepTime],
      ["Country", recipe.country?.name || "-"],
      ["Stage", recipe.stage?.title || "-"],
    ]);

    if (recipe.nutritionTags?.length) {
      sectionTitle(doc, "Nutrition Tags");
      chipRow(doc, recipe.nutritionTags);
    }

    if (recipe.ingredients?.length) {
      sectionTitle(doc, "Ingredients");

      recipe.ingredients.forEach((item) => {
        ensureSpace(doc, 40);

        doc
          .font("Helvetica")
          .fontSize(FONT_SIZES.body + 1)
          .fillColor(DARK)
          .text(`\u2022 ${item.name}`, 55, doc.y, { continued: true });

        doc.fillColor(GRAY).text(`   ${item.quantity}`);

        doc.moveDown(0.3);
      });

      drawDivider(doc);
    }

    if (recipe.instructions?.length) {
      sectionTitle(doc, "Instructions");

      recipe.instructions.forEach((step, index) => {
        ensureSpace(doc, 40);

        const y = doc.y;

        doc.circle(60, y + 7, 8).fill(PRIMARY);

        doc
          .fillColor("white")
          .fontSize(FONT_SIZES.small)
          .font("Helvetica-Bold")
          .text(String(step.step || index + 1), 57, y + 3);

        doc
          .fillColor(DARK)
          .fontSize(FONT_SIZES.body + 1)
          .font("Helvetica")
          .text(step.description || "", 80, y, { width: 430 });

        doc.moveDown(1);
      });
    }

    if (recipe.acceptanceLabel) {
      sectionTitle(doc, "Acceptance");

      const y = doc.y;

      doc.roundedRect(50, y, 250, 32, 6).fillAndStroke("#FFF4EE", PRIMARY);

      doc
        .fillColor(PRIMARY)
        .fontSize(FONT_SIZES.label)
        .font("Helvetica-Bold")
        .text(recipe.acceptanceLabel, 65, y + 10);

      doc.y = y + 32 + 20;
    }

    if (recipe.notes) {
      sectionTitle(doc, "Notes");

      doc
        .fontSize(FONT_SIZES.body + 1)
        .fillColor(DARK)
        .font("Helvetica")
        .text(recipe.notes, MARGIN, doc.y, { width: CONTENT_WIDTH });
    }

    doc.end();
  });
};

module.exports = { generateRecipePdf };
