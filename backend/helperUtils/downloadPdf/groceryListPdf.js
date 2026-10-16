const PDFDocument = require("pdfkit");

const {
  DARK,
  GRAY,
  LIGHT,
  CHIP_BG,
  PRIMARY,
  MARGIN,
  CONTENT_WIDTH,
  FONT_SIZES,
} = require("./constants");

const { drawHeader, ensureSpace, sectionTitle } = require("./layout");
const { chip, drawDivider } = require("./helpers");

const generateGroceryPdf = (data) => {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: MARGIN, size: "A4" });

    const buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));

    drawHeader(doc, "Grocery List");

    sectionTitle(doc, "Recipes Included");

    data.recipesIncluded.forEach((recipe) => {
      ensureSpace(doc, 45);

      const y = doc.y;

      doc.roundedRect(50, y, CONTENT_WIDTH + 10, 28, 4).fill(CHIP_BG);

      doc
        .fillColor(PRIMARY)
        .font("Helvetica-Bold")
        .fontSize(FONT_SIZES.label)
        .text(recipe.title, 65, y + 8);

      doc.y = y + 40;
    });

    drawDivider(doc);

    sectionTitle(doc, "Checklist");

    data.groceryChecklist.forEach((item) => {
      ensureSpace(doc, 65);

      const y = doc.y;
      const box = item.checked ? "\u2611" : "\u2610";

      doc.roundedRect(50, y, CONTENT_WIDTH + 10, 55, 5).stroke(LIGHT);

      doc
        .font("Helvetica-Bold")
        .fontSize(FONT_SIZES.label + 1)
        .fillColor(DARK)
        .text(`${box} ${item.name}`, 65, y + 10);

      doc
        .font("Helvetica")
        .fontSize(FONT_SIZES.body)
        .fillColor(GRAY)
        .text(`Quantity: ${item.quantity}`, 80, y + 28);

      doc.text(`Category: ${item.category}`, 250, y + 28);

      doc.y = y + 70;
    });

    drawDivider(doc);

    sectionTitle(doc, "Categories");

    data.ingredientCategories.forEach((category) => {
      ensureSpace(doc, 60);

      const uniqueItems = [...new Set(category.items)];
      const y = doc.y;

      chip(doc, category.category, 50, y);

      doc.y = y + 35;

      uniqueItems.forEach((item) => {
        doc
          .fillColor(GRAY)
          .font("Helvetica")
          .fontSize(FONT_SIZES.body + 1)
          .text(`\u2022 ${item}`, 65);
      });

      doc.moveDown();
    });
    doc.end();
  });
};

module.exports = { generateGroceryPdf };
