const PDFDocument = require("pdfkit");

const {
  PRIMARY,
  SUCCESS,
  WARNING,
  DARK,
  GRAY,
  LIGHT,
  CARD,
  PAGE_WIDTH,
  MARGIN,
  CONTENT_WIDTH,
  FONT_SIZES,
} = require("./constants");

const {
  drawHeader,
  ensureSpace,
  sectionTitle,
  infoCard,
} = require("./layout");
const { statusBadge } = require("./helpers");

function drawProgress(doc, percentage) {
  ensureSpace(doc, 80);

  doc
    .font("Helvetica-Bold")
    .fontSize(28)
    .fillColor(PRIMARY)
    .text(`${percentage}%`, MARGIN, doc.y, {
      width: CONTENT_WIDTH,
      align: "center",
    });

  doc.moveDown(0.5);

  const barWidth = 350;
  const barHeight = 12;
  const x = (PAGE_WIDTH - barWidth) / 2;
  const y = doc.y;

  doc.roundedRect(x, y, barWidth, barHeight, 6).fill(LIGHT);
  doc
    .roundedRect(x, y, barWidth * (percentage / 100), barHeight, 6)
    .fill(PRIMARY);

  doc.y = y + barHeight + 25;
}

function mealCard(doc, meal) {
  ensureSpace(doc, 90);

  const top = doc.y;

  doc.roundedRect(45, top, PAGE_WIDTH - 90, 70, 8).fillAndStroke(CARD, LIGHT);

  doc
    .font("Helvetica-Bold")
    .fontSize(FONT_SIZES.label)
    .fillColor(PRIMARY)
    .text(meal.time, 60, top + 12);

  doc
    .font("Helvetica-Bold")
    .fontSize(FONT_SIZES.sectionTitle - 1)
    .fillColor(DARK)
    .text(meal.title, 160, top + 10);

  if (meal.description) {
    doc
      .font("Helvetica")
      .fontSize(FONT_SIZES.body)
      .fillColor(GRAY)
      .text(meal.description, 160, top + 30, { width: 230 });
  }

  statusBadge(
    doc,
    meal.completed ? "Completed" : "Pending",
    meal.completed ? SUCCESS : WARNING,
    445,
    top + 15,
  );

  doc.y = top + 82;
}

function noteCard(doc, note) {
  ensureSpace(doc, 50);

  const top = doc.y;

  doc
    .roundedRect(45, top, PAGE_WIDTH - 90, 36, 6)
    .fillAndStroke("#FFFFFF", LIGHT);

  doc
    .font("Helvetica-Bold")
    .fontSize(FONT_SIZES.sectionTitle)
    .fillColor(SUCCESS)
    .text("\u2713", 60, top + 10);

  doc
    .font("Helvetica")
    .fontSize(FONT_SIZES.body + 1)
    .fillColor(DARK)
    .text(note, 85, top + 10, { width: 430 });

  doc.y = top + 45;
}

const generateFeedingTimeTablePdf = (response) => {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ size: "A4", margin: MARGIN });

    const buffers = [];
    doc.on("data", buffers.push.bind(buffers));
    doc.on("end", () => resolve(Buffer.concat(buffers)));

    drawHeader(doc, "Feeding Timetable");

    sectionTitle(doc, "Baby Information");

    infoCard(doc, [
      ["Name", response.babyInfo.name],
      ["Stage", response.babyInfo.stage.title],
      ["Countries", response.babyInfo.countries.map((c) => c.name).join(", ")],
    ]);

    sectionTitle(doc, "Today's Progress");
    drawProgress(doc, response.completionRate);

    sectionTitle(doc, "Today's Schedule");

    if (!response.recommendedToday.length) {
      doc
        .font("Helvetica")
        .fontSize(FONT_SIZES.body + 2)
        .fillColor(GRAY)
        .text("No meals scheduled for today.", MARGIN, doc.y, {
          width: CONTENT_WIDTH,
          align: "center",
        });

      doc.moveDown();
    } else {
      response.recommendedToday.forEach((meal) => mealCard(doc, meal));
    }

    sectionTitle(doc, "Feeding Notes");

    response.feedingNotes.forEach((note) => noteCard(doc, note));
    doc.end();
  });
};

module.exports = { generateFeedingTimeTablePdf };
