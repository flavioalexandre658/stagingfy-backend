import { Router } from 'express';
import { AuthController } from '@/controllers/auth.controller';
import { authMiddleware } from '@/middleware/auth-middleware';

const router = Router();
const authController = new AuthController();

// Apply authentication middleware to all routes
router.use(authMiddleware);

/**
 * GET /user/profile
 * Get current user profile
 */
router.get('/profile', authController.getProfile.bind(authController));

/**
 * PUT /user/profile
 * Update current user profile
 */
router.put('/profile', authController.updateProfile.bind(authController));

/**
 * DELETE /user/profile
 * Delete current user account
 */
router.delete('/profile', authController.deleteAccount.bind(authController));

/**
 * GET /user/stats
 * Get user statistics
 */
router.get('/stats', authController.getStats.bind(authController));

export default router;