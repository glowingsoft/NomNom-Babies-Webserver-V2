const express = require('express');
const {
  createLanguage,
  getLanguages,
  updateLanguage,
  deleteLanguage,
  getLanguageTranslations,
  updateLanguageTranslations,
} = require('../controllers/languageController');
const auth = require('../../middlewares/authMiddleware');
const roleMiddleware = require('../../middlewares/roleMiddleware');

const router = express.Router();
router.use(auth);

router.post('/',roleMiddleware(["admin"]), createLanguage);

router.get('/', getLanguages);

router.get('/:id/translations', roleMiddleware(["admin"]), getLanguageTranslations);

router.put('/:id/translations', roleMiddleware(["admin"]), updateLanguageTranslations);

router.put('/:id',roleMiddleware(["admin"]), updateLanguage);

router.delete('/:id',roleMiddleware(["admin"]), deleteLanguage);

module.exports = router;
