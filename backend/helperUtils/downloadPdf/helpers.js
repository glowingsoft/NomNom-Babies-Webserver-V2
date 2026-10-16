const {
  PRIMARY,
  CHIP_BG,
  FONT_SIZES,
  MARGIN,
  PAGE_WIDTH,
} = require("./constants");
const { ensureSpace } = require("./layout");

/**
 * Small pill/chip, e.g. nutrition tags or category labels.
 * Returns the width used so callers can flow chips left-to-right.
 */
function chip(doc, text, x, y) {
  const width = doc.widthOfString(text) + 24;

  doc.roundedRect(x, y, width, 22, 11).fillAndStroke(CHIP_BG, PRIMARY);

  doc
    .fillColor(PRIMARY)
    .font("Helvetica-Bold")
    .fontSize(FONT_SIZES.small)
    .text(text, x + 12, y + 6);

  return width;
}

/** Wraps a list of chips onto multiple lines within the content width. */
function chipRow(doc, texts) {
  ensureSpace(doc, 40);

  let x = MARGIN + 10;
  let y = doc.y;

  texts.forEach((text) => {
    const width = doc.widthOfString(text) + 24;

    if (x + width > PAGE_WIDTH - MARGIN) {
      x = MARGIN + 10;
      y += 30;
    }

    chip(doc, text, x, y);
    x += width + 10;
  });

  doc.y = y + 40;
}

/** Small colored status badge, e.g. Completed / Pending. */
function statusBadge(doc, text, color, x, y, width = 80) {
  doc.roundedRect(x, y, width, 24, 12).fill(color);

  doc
    .font("Helvetica-Bold")
    .fontSize(FONT_SIZES.small)
    .fillColor("white")
    .text(text, x, y + 7, { width, align: "center" });
}

const drawDivider = (doc) => {
  doc.moveDown(0.5);
};

module.exports = {
  chip,
  chipRow,
  statusBadge,
  drawDivider,
};
