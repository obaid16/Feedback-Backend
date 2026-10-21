import { Router } from 'express';
import authRoutes from './auth.routes.js';
import userRoutes from './user.routes.js';
import departmentRoutes from './department.routes.js';
import courseRoutes from './course.routes.js';
import facultyRoutes from './faculty.routes.js';
import formRoutes from './form.routes.js';
import campaignRoutes from './campaign.routes.js';
import submissionRoutes from './submission.routes.js';
import aiRoutes from './ai.routes.js';
import reportRoutes from './report.routes.js';
import analyticsRoutes from './analytics.routes.js';
import notificationRoutes from './notification.routes.js';
import reminderRoutes from './reminder.routes.js';
import settingsRoutes from './settings.routes.js';
import healthRoutes from './health.routes.js';

const apiV1Router = Router();

apiV1Router.use('/auth', authRoutes);
apiV1Router.use('/users', userRoutes);
apiV1Router.use('/departments', departmentRoutes);
apiV1Router.use('/courses', courseRoutes);
apiV1Router.use('/faculty', facultyRoutes);
apiV1Router.use('/feedback-forms', formRoutes);
apiV1Router.use('/campaigns', campaignRoutes);
apiV1Router.use('/submissions', submissionRoutes);
apiV1Router.use('/ai', aiRoutes);
apiV1Router.use('/reports', reportRoutes);
apiV1Router.use('/analytics', analyticsRoutes);
apiV1Router.use('/notifications', notificationRoutes);
apiV1Router.use('/reminders', reminderRoutes);
apiV1Router.use('/settings', settingsRoutes);
apiV1Router.use('/health', healthRoutes);

export default apiV1Router;
