const express = require('express');
const router = express.Router();
const UserController = require('../controllers/userController');
const { authMiddleware } = require('../middleware/authMiddleware');
const { updateProfileSchema, validate } = require('../validators/userValidator');

/**
 * User Routes
 * All routes require authentication and input validation
 */

// Get user statistics
router.get('/stats', authMiddleware, UserController.getUserStats);

// Update user profile
router.put(
  '/profile', 
  authMiddleware,
  validate(updateProfileSchema, 'body'),
  UserController.updateUserProfile
);

module.exports = router;
