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
} = require("./constants");

const HEADER_HEIGHT = 90;
const BADGE_WIDTH = 96;
const BADGE_HEIGHT = 56;
const LOGO_ASPECT = 653 / 382;

const WATERMARK_WIDTH = 360;
const WATERMARK_OPACITY = 0.20;

function drawWatermark(doc) {
  if (!doc._pdfLogo) return;

  const height = WATERMARK_WIDTH / LOGO_ASPECT;

  doc.save();
  doc.opacity(WATERMARK_OPACITY);
  doc.image(
    doc._pdfLogo,
    (PAGE_WIDTH - WATERMARK_WIDTH) / 2,
    (PAGE_HEIGHT - height) / 2,
    { width: WATERMARK_WIDTH, height },
  );
  doc.restore();
}

function drawHeader(doc, title, subtitle) {
  drawWatermark(doc);

  doc.save();

  doc.rect(0, 0, PAGE_WIDTH, HEADER_HEIGHT).fill(PRIMARY);
  doc.rect(0, HEADER_HEIGHT, PAGE_WIDTH, 4).fill("#D9531A");

  let textX = MARGIN;

  if (doc._pdfLogo) {
    const badgeY = (HEADER_HEIGHT - BADGE_HEIGHT) / 2;

    doc
      .roundedRect(MARGIN, badgeY, BADGE_WIDTH, BADGE_HEIGHT, 12)
      .fill("white");

    const logoWidth = BADGE_WIDTH - 16;
    const logoHeight = logoWidth / LOGO_ASPECT;

    doc.image(doc._pdfLogo, MARGIN + 8, badgeY + (BADGE_HEIGHT - logoHeight) / 2, {
      width: logoWidth,
      height: logoHeight,
    });

    textX = MARGIN + BADGE_WIDTH + 16;
  }

  const textWidth = PAGE_WIDTH - MARGIN - textX;
  const subtitleText =
    subtitle || `Generated on ${new Date().toLocaleDateString()}`;

  doc.font("Helvetica-Bold").fontSize(FONT_SIZES.pageTitle);
  const titleHeight = doc.heightOfString(title, { width: textWidth });
  doc.font("Helvetica").fontSize(FONT_SIZES.pageSubtitle);
  const subtitleHeight = doc.heightOfString(subtitleText, {
    width: textWidth,
  });

  const blockHeight = titleHeight + 4 + subtitleHeight;
  const top = Math.max(8, (HEADER_HEIGHT - blockHeight) / 2);

  doc
    .fillColor("white")
    .font("Helvetica-Bold")
    .fontSize(FONT_SIZES.pageTitle)
    .text(title, textX, top, { width: textWidth, align: "left" });

  doc
    .fillOpacity(0.9)
    .font("Helvetica")
    .fontSize(FONT_SIZES.pageSubtitle)
    .text(subtitleText, textX, top + titleHeight + 4, {
      width: textWidth,
      align: "left",
    });

  doc.restore();

  doc.y = HEADER_HEIGHT + 28;

  doc._pdfHeaderTitle = title;
  doc._pdfHeaderSubtitle = subtitle;
}

function ensureSpace(doc, requiredHeight = 120) {
  if (doc.y + requiredHeight > PAGE_HEIGHT - 60) {
    doc.addPage();
    drawHeader(doc, doc._pdfHeaderTitle, doc._pdfHeaderSubtitle);
  }
}

function addFooters(doc) {
  const range = doc.bufferedPageRange();

  for (let i = range.start; i < range.start + range.count; i++) {
    doc.switchToPage(i);

    const bottomMargin = doc.page.margins.bottom;
    doc.page.margins.bottom = 0;

    doc
      .moveTo(MARGIN, PAGE_HEIGHT - 48)
      .lineTo(PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 48)
      .strokeColor(LIGHT)
      .lineWidth(1)
      .stroke();

    doc
      .font("Helvetica")
      .fontSize(FONT_SIZES.small - 1)
      .fillColor(GRAY)
      .text("NomNom Babies", MARGIN, PAGE_HEIGHT - 38, {
        width: CONTENT_WIDTH / 2,
        align: "left",
        lineBreak: false,
      });

    doc.text(
      `Page ${i - range.start + 1} of ${range.count}`,
      MARGIN + CONTENT_WIDTH / 2,
      PAGE_HEIGHT - 38,
      { width: CONTENT_WIDTH / 2, align: "right", lineBreak: false },
    );

    doc.page.margins.bottom = bottomMargin;
  }
}

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

  doc.moveDown(0.6);
}

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

  doc.y = top + height + 20;
}

function calloutBox(doc, title, text, { fill, stroke, color }) {
  const padding = 14;
  const boxWidth = PAGE_WIDTH - 90;
  const innerWidth = boxWidth - padding * 2;

  doc.font("Helvetica").fontSize(FONT_SIZES.body + 1);
  const textHeight = doc.heightOfString(text, { width: innerWidth });
  const height = padding * 2 + 16 + textHeight;

  ensureSpace(doc, height + 20);

  const top = doc.y;

  doc.roundedRect(45, top, boxWidth, height, 8).fillAndStroke(fill, stroke);

  doc
    .font("Helvetica-Bold")
    .fontSize(FONT_SIZES.label)
    .fillColor(color)
    .text(title, 45 + padding, top + padding, { width: innerWidth });

  doc
    .font("Helvetica")
    .fontSize(FONT_SIZES.body + 1)
    .fillColor(DARK)
    .text(text, 45 + padding, top + padding + 18, { width: innerWidth });

  doc.y = top + height + 20;
}

module.exports = {
  drawHeader,
  ensureSpace,
  addFooters,
  sectionTitle,
  infoCard,
  calloutBox,
};
