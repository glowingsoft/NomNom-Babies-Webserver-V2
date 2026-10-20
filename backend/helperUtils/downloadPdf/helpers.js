const {
  PRIMARY,
  CHIP_BG,
  FONT_SIZES,
  MARGIN,
  PAGE_WIDTH,
} = require("./constants");
const { ensureSpace } = require("./layout");

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

function statusBadge(doc, text, color, x, y, width = 80) {
  doc.roundedRect(x, y, width, 24, 12).fill(color);

  doc
    .font("Helvetica-Bold")
    .fontSize(FONT_SIZES.small)
    .fillColor("white")
    .text(text, x, y + 7, { width, align: "center" });
}

function drawTick(doc, x, y, color, size = 10) {
  doc
    .save()
    .lineWidth(2)
    .lineCap("round")
    .lineJoin("round")
    .strokeColor(color)
    .moveTo(x, y + size * 0.55)
    .lineTo(x + size * 0.38, y + size * 0.9)
    .lineTo(x + size, y + size * 0.1)
    .stroke()
    .restore();
}

function drawCheckbox(doc, x, y, checked, size = 12) {
  doc.save();

  if (checked) {
    doc.roundedRect(x, y, size, size, 3).fill(PRIMARY);
    drawTick(doc, x + 2, y + 2, "white", size - 4);
  } else {
    doc.roundedRect(x, y, size, size, 3).lineWidth(1.2).stroke(PRIMARY);
  }

  doc.restore();
}

const drawDivider = (doc) => {
  doc.moveDown(0.5);
};

module.exports = {
  chip,
  chipRow,
  statusBadge,
  drawTick,
  drawCheckbox,
  drawDivider,
};
