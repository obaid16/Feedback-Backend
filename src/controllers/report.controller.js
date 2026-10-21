import fs from 'node:fs';
import path from 'node:path';
import {
  getReportById,
  listFacultyReports,
  generateFacultyReport
} from '../services/report.service.js';
import { generateFacultyReportPdf } from '../services/pdf/reportPdf.js';
import { sendSuccess, sendPaginated } from '../utils/response.js';
import { NotFoundError, ForbiddenError } from '../utils/errors.js';
import { ROLES } from '../constants/roles.js';

export async function getReports(req, res, next) {
  try {
    const { campaignId, facultyId, page = 1, limit = 10 } = req.query;
    const result = await listFacultyReports({
      campaignId,
      facultyId,
      page: Number(page),
      limit: Number(limit)
    });

    return sendPaginated(res, result.items, { page: result.page, limit: result.limit, total: result.total });
  } catch (err) {
    next(err);
  }
}

export async function getReport(req, res, next) {
  try {
    const report = await getReportById(req.params.id);

    // If student attempts to view faculty report directly, block
    if (req.user.role === ROLES.STUDENT) {
      throw new ForbiddenError('Students are not authorized to access confidential faculty evaluation reports.');
    }

    return sendSuccess(res, { report });
  } catch (err) {
    next(err);
  }
}

export async function downloadReportPdf(req, res, next) {
  try {
    const report = await getReportById(req.params.id);

    if (req.user.role === ROLES.STUDENT) {
      throw new ForbiddenError('Unauthorized to download faculty reports.');
    }

    let filePath = report.pdfFilePath;

    // If PDF file does not exist on disk, regenerate it on the fly
    if (!filePath || !fs.existsSync(filePath)) {
      const { filePath: newPath } = await generateFacultyReportPdf(
        report,
        report.faculty,
        report.campaign,
        report.campaign?.targetCourse
      );
      filePath = newPath;
      report.pdfFilePath = newPath;
      await report.save();
    }

    const safeFilename = `Faculty_Evaluation_${report.faculty?.displayName?.replace(/[^a-zA-Z0-9_-]/g, '_')}_v${report.version}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`);

    const stream = fs.createReadStream(filePath);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
}

export async function regenerateReport(req, res, next) {
  try {
    const existing = await getReportById(req.params.id);
    const newReport = await generateFacultyReport({
      campaignId: existing.campaign._id,
      facultyId: existing.faculty._id,
      reportingPeriod: existing.reportingPeriod,
      userId: req.user._id
    });

    return sendSuccess(res, { report: newReport }, 'Report regenerated successfully', 201);
  } catch (err) {
    next(err);
  }
}
