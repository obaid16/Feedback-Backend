import PDFDocument from 'pdfkit';
import fs from 'node:fs';
import path from 'node:path';
import { env } from '../../config/env.js';
import { logger } from '../../config/logger.js';

/**
 * Generate a styled institutional PDF report for a Faculty Evaluation
 */
export async function generateFacultyReportPdf(report, faculty, campaign, course) {
  // Ensure storage directory exists
  const storageDir = path.resolve(env.REPORT_STORAGE_PATH);
  if (!fs.existsSync(storageDir)) {
    fs.mkdirSync(storageDir, { recursive: true });
  }

  const fileName = `report_${report._id}_v${report.version}.pdf`;
  const filePath = path.join(storageDir, fileName);

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 40, bottom: 40, left: 45, right: 45 },
        info: {
          Title: `Faculty Feedback Report - ${faculty.displayName}`,
          Author: 'Institutional Feedback & Intelligence Portal',
          Subject: `${campaign.title} (${report.reportingPeriod})`
        }
      });

      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      // --- Header Banner ---
      doc.rect(45, 40, 505, 55).fill('#0f172a');
      doc.fillColor('#ffffff')
        .fontSize(18)
        .font('Helvetica-Bold')
        .text('FACULTY FEEDBACK & INTELLIGENCE REPORT', 60, 52);
      doc.fontSize(10)
        .font('Helvetica')
        .fillColor('#94a3b8')
        .text('OFFICIAL ACADEMIC EVALUATION • CONFIDENTIAL INSTITUTIONAL RECORD', 60, 74);

      doc.moveDown(3);

      // --- Metadata Grid ---
      const metaY = 110;
      doc.roundedRect(45, metaY, 505, 75, 4).lineWidth(1).stroke('#e2e8f0');

      doc.fontSize(10).font('Helvetica-Bold').fillColor('#334155');
      doc.text('Faculty Name:', 60, metaY + 12);
      doc.font('Helvetica').fillColor('#0f172a').text(faculty.displayName, 150, metaY + 12);

      doc.font('Helvetica-Bold').fillColor('#334155').text('Course:', 60, metaY + 30);
      doc.font('Helvetica').fillColor('#0f172a').text(`${course?.code || ''} - ${course?.name || 'General Evaluation'}`, 150, metaY + 30);

      doc.font('Helvetica-Bold').fillColor('#334155').text('Period:', 60, metaY + 48);
      doc.font('Helvetica').fillColor('#0f172a').text(report.reportingPeriod, 150, metaY + 48);

      doc.font('Helvetica-Bold').fillColor('#334155').text('Campaign:', 320, metaY + 12);
      doc.font('Helvetica').fillColor('#0f172a').text(campaign.title, 390, metaY + 12);

      doc.font('Helvetica-Bold').fillColor('#334155').text('Generated:', 320, metaY + 30);
      doc.font('Helvetica').fillColor('#0f172a').text(new Date().toLocaleDateString(), 390, metaY + 30);

      doc.font('Helvetica-Bold').fillColor('#334155').text('Report Version:', 320, metaY + 48);
      doc.font('Helvetica').fillColor('#0f172a').text(`v${report.version}`, 410, metaY + 48);

      // --- Executive KPI Summary Cards ---
      const cardY = 200;
      const stats = report.quantitativeStats || {};

      // Card 1: Overall Average
      doc.roundedRect(45, cardY, 115, 60, 4).fill('#f8fafc');
      doc.rect(45, cardY, 115, 60).stroke('#cbd5e1');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748b').text('AVERAGE RATING', 55, cardY + 10);
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#2563eb').text(`${Number(stats.overallAverageRating || 0).toFixed(2)} / 5`, 55, cardY + 25);

      // Card 2: Total Submissions
      doc.roundedRect(175, cardY, 115, 60, 4).fill('#f8fafc');
      doc.rect(175, cardY, 115, 60).stroke('#cbd5e1');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748b').text('TOTAL RESPONSES', 185, cardY + 10);
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#0f172a').text(`${stats.totalResponses || 0}`, 185, cardY + 25);

      // Card 3: Eligible Students
      doc.roundedRect(305, cardY, 115, 60, 4).fill('#f8fafc');
      doc.rect(305, cardY, 115, 60).stroke('#cbd5e1');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748b').text('ELIGIBLE AUDIENCE', 315, cardY + 10);
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#0f172a').text(`${stats.totalEligibleStudents || 0}`, 315, cardY + 25);

      // Card 4: Response Rate
      doc.roundedRect(435, cardY, 115, 60, 4).fill('#f8fafc');
      doc.rect(435, cardY, 115, 60).stroke('#cbd5e1');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748b').text('RESPONSE RATE', 445, cardY + 10);
      doc.fontSize(18).font('Helvetica-Bold').fillColor('#059669').text(`${stats.responseRatePercentage || 0}%`, 445, cardY + 25);

      let currentY = 280;

      // --- Rating Distribution Bars ---
      if (stats.ratingDistribution && stats.ratingDistribution.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text('Rating Distribution (1 - 5 Stars)', 45, currentY);
        currentY += 18;

        stats.ratingDistribution.forEach((dist) => {
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#475569').text(`${dist.rating} ★`, 45, currentY + 2);
          // Background bar
          doc.rect(75, currentY, 350, 12).fill('#e2e8f0');
          // Filled bar
          const fillWidth = Math.max((dist.percentage / 100) * 350, 0);
          if (fillWidth > 0) {
            doc.rect(75, currentY, fillWidth, 12).fill('#3b82f6');
          }
          doc.fontSize(9).font('Helvetica').fillColor('#475569').text(`${dist.count} (${dist.percentage}%)`, 435, currentY + 2);
          currentY += 18;
        });
        currentY += 10;
      }

      // --- Category Breakdown ---
      if (stats.categoryScores && stats.categoryScores.length > 0) {
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text('Dimension Breakdown', 45, currentY);
        currentY += 16;

        stats.categoryScores.forEach((cat) => {
          doc.fontSize(9).font('Helvetica-Bold').fillColor('#334155').text(cat.category, 45, currentY);
          doc.font('Helvetica').fillColor('#2563eb').text(`Average: ${Number(cat.averageRating).toFixed(2)} / 5.0  (${cat.totalResponses} responses)`, 250, currentY);
          currentY += 14;
        });
        currentY += 15;
      }

      // --- Qualitative Synthesis Section ---
      const synthesis = report.qualitativeSynthesis || {};

      if (synthesis.executiveSummary) {
        if (currentY > 680) { doc.addPage(); currentY = 50; }
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text('Executive Summary', 45, currentY);
        currentY += 16;
        doc.fontSize(9.5).font('Helvetica').fillColor('#334155').text(synthesis.executiveSummary, 45, currentY, { width: 505, align: 'justify' });
        currentY += doc.heightOfString(synthesis.executiveSummary, { width: 505 }) + 15;
      }

      // Teaching Strengths
      if (synthesis.teachingStrengths && synthesis.teachingStrengths.length > 0) {
        if (currentY > 680) { doc.addPage(); currentY = 50; }
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#059669').text('Key Teaching Strengths', 45, currentY);
        currentY += 16;
        synthesis.teachingStrengths.forEach((strength) => {
          doc.fontSize(9.5).font('Helvetica').fillColor('#1e293b').text(`•  ${strength}`, 55, currentY, { width: 495 });
          currentY += doc.heightOfString(`•  ${strength}`, { width: 495 }) + 6;
        });
        currentY += 10;
      }

      // Improvement Opportunities
      if (synthesis.improvementOpportunities && synthesis.improvementOpportunities.length > 0) {
        if (currentY > 680) { doc.addPage(); currentY = 50; }
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#d97706').text('Pedagogical Growth Opportunities', 45, currentY);
        currentY += 16;
        synthesis.improvementOpportunities.forEach((opp) => {
          doc.fontSize(9.5).font('Helvetica').fillColor('#1e293b').text(`•  ${opp}`, 55, currentY, { width: 495 });
          currentY += doc.heightOfString(`•  ${opp}`, { width: 495 }) + 6;
        });
        currentY += 10;
      }

      // Actionable Recommendations
      if (synthesis.actionableRecommendations && synthesis.actionableRecommendations.length > 0) {
        if (currentY > 680) { doc.addPage(); currentY = 50; }
        doc.fontSize(12).font('Helvetica-Bold').fillColor('#2563eb').text('Actionable Development Recommendations', 45, currentY);
        currentY += 16;
        synthesis.actionableRecommendations.forEach((rec, idx) => {
          doc.fontSize(9.5).font('Helvetica').fillColor('#1e293b').text(`${idx + 1}.  ${rec}`, 55, currentY, { width: 495 });
          currentY += doc.heightOfString(`${idx + 1}.  ${rec}`, { width: 495 }) + 6;
        });
        currentY += 15;
      }

      // Confidentiality & Technical Anonymity Notice Footer
      if (currentY > 720) { doc.addPage(); currentY = 50; }
      doc.roundedRect(45, currentY, 505, 45, 4).fill('#f1f5f9');
      doc.fontSize(8).font('Helvetica-Bold').fillColor('#475569').text('DATA INTEGRITY & PRIVACY STATEMENT:', 55, currentY + 8);
      doc.fontSize(7.5).font('Helvetica').fillColor('#64748b').text(
        'Student feedback is aggregated with architectural anonymity guarantees. Numerical figures are computed deterministically. This document is confidential and intended solely for authorized academic leadership and faculty development review.',
        55,
        currentY + 20,
        { width: 485 }
      );

      doc.end();

      writeStream.on('finish', () => {
        logger.info({ filePath }, 'Report PDF generated successfully');
        resolve({ filePath, fileName });
      });

      writeStream.on('error', (err) => {
        logger.error({ err }, 'Write stream error while generating PDF');
        reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}
