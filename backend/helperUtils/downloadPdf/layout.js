const {
  PRIMARY,
  DARK,
  GRAY,
  LIGHT,
  CARD,
  PAGE_WIDTH,
  PAGE_HEIGHT,
  MARGIN,
  CONTENT_WIDTH,
  FONT_SIZES,
  LOGO_PATH,
  LOGO_SIZE,
} = require("./constants");

/**
 * Draws the orange page header. Title/subtitle are always centered,
 * and an optional logo is drawn to the left of the title.
 * The header remembers what was drawn so ensureSpace() can redraw an
 * identical header on new pages.
 */
function drawHeader(doc, title, subtitle) {
  doc.save();

  doc.rect(0, 0, PAGE_WIDTH, 85).fill(PRIMARY);

  if (LOGO_PATH) {
    doc.image(LOGO_PATH, MARGIN, (85 - LOGO_SIZE) / 2, {
      width: LOGO_SIZE,
      height: LOGO_SIZE,
    });
  }

  doc
    .fillColor("white")
    .font("Helvetica-Bold")
    .fontSize(FONT_SIZES.pageTitle)
    .text(title, 0, 28, { width: PAGE_WIDTH, align: "center" });

  doc
    .font("Helvetica")
    .fontSize(FONT_SIZES.pageSubtitle)
    .text(
      subtitle || `Generated on ${new Date().toLocaleDateString()}`,
      0,
      58,
      {
        width: PAGE_WIDTH,
        align: "center",
      },
    );

  doc.restore();

  doc.y = 105;

  // remember for page breaks
  doc._pdfHeaderTitle = title;
  doc._pdfHeaderSubtitle = subtitle;
}

function ensureSpace(doc, requiredHeight = 120) {
  if (doc.y + requiredHeight > PAGE_HEIGHT - 70) {
    doc.addPage();
    drawHeader(doc, doc._pdfHeaderTitle, doc._pdfHeaderSubtitle);
  }
}

/** Centered section title with a centered underline beneath it. */
function sectionTitle(doc, title) {
  ensureSpace(doc, 50);

  doc.moveDown(0.4);

  doc
    .font("Helvetica-Bold")
    .fontSize(FONT_SIZES.sectionTitle)
    .fillColor(PRIMARY)
    .text(title, MARGIN, doc.y, { width: CONTENT_WIDTH, align: "center" });

  doc.moveDown(0.3);

  const lineWidth = 60;
  const lineX = PAGE_WIDTH / 2 - lineWidth / 2;

  doc
    .strokeColor(PRIMARY)
    .lineWidth(2)
    .moveTo(lineX, doc.y)
    .lineTo(lineX + lineWidth, doc.y)
    .stroke();

  doc.moveDown();
}

/**
 * Generic bordered card that draws a list of label/value rows and
 * sizes itself to fit the content (fixes the "card + next section
 * squashed together" issue — height is never hardcoded).
 * rows: [[label, value], ...]
 */
function infoCard(doc, rows) {
  const paddingY = 14;
  const rowHeight = 18;
  const height = paddingY * 2 + rows.length * rowHeight;

  ensureSpace(doc, height + 40);

  const top = doc.y;

  doc
    .roundedRect(45, top, PAGE_WIDTH - 90, height, 8)
    .fillAndStroke(CARD, LIGHT);

  let y = top + paddingY;

  rows.forEach(([label, value]) => {
    doc
      .font("Helvetica-Bold")
      .fontSize(FONT_SIZES.label)
      .fillColor(DARK)
      .text(`${label}:`, 60, y, { continued: true });

    doc.font("Helvetica").fillColor(GRAY).text(` ${value}`);

    y += rowHeight;
  });

  doc.y = top + height + 20; // guaranteed breathing room before next section
}


module.exports = {
  drawHeader,
  ensureSpace,
  sectionTitle,
  infoCard,
};
