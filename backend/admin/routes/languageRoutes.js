const express = require('express');
const {
  createLanguage,
  getLanguages,
  updateLanguage,
  deleteLanguage,
} = require('../controllers/languageController');
const auth = require('../../middlewares/authMiddleware');
const roleMiddleware = require('../../middlewares/roleMiddleware');

const router = express.Router();
router.use(auth);

// Create a new language
router.post('/',roleMiddleware(["admin"]), createLanguage);

// Get all languages with pagination
router.get('/', getLanguages);

// Update an existing language
router.put('/:id',roleMiddleware(["admin"]), updateLanguage);

// Delete a language
router.delete('/:id',roleMiddleware(["admin"]), deleteLanguage);


module.exports = router;
