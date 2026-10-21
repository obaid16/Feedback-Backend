import { generateFeedbackFormWithAI } from '../services/ai/formGenerator.js';
import { generateFacultyReport } from '../services/report.service.js';
import { createFeedbackForm } from '../services/form.service.js';
import { sendSuccess } from '../utils/response.js';

export async function generateFormWithAI(req, res, next) {
  try {
    const aiDraft = await generateFeedbackFormWithAI(req.body);

    // If autoSaveDraft flag is provided, persist as a draft form directly
    if (req.body.autoSaveDraft) {
      const savedForm = await createFeedbackForm({
        title: aiDraft.title,
        description: aiDraft.description,
        sections: aiDraft.sections,
        questions: aiDraft.questions,
        userId: req.user._id,
        aiMetadata: {
          isAiGenerated: true,
          promptContext: req.body
        }
      });
      return sendSuccess(res, { form: savedForm }, 'Draft form generated and saved successfully', 201);
    }

    return sendSuccess(res, { draft: aiDraft }, 'AI form draft generated successfully');
  } catch (err) {
    next(err);
  }
}

export async function generateReportWithAI(req, res, next) {
  try {
    const { campaignId, facultyId, reportingPeriod } = req.body;
    const report = await generateFacultyReport({
      campaignId,
      facultyId,
      reportingPeriod,
      userId: req.user._id
    });

    const isInsufficient = report.status === 'insufficient_data';
    const message = isInsufficient
      ? 'Report generation withheld due to small-sample anonymity threshold.'
      : 'Faculty report generated and synthesized successfully.';

    return sendSuccess(res, { report }, message, isInsufficient ? 200 : 201);
  } catch (err) {
    next(err);
  }
}
