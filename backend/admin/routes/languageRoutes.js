const express = require('express');
const {
  createLanguage,
  getLanguages,
  updateLanguage,
  deleteLanguage,
  getAllTranslations,
  saveAllTranslations,
} = require('../controllers/languageController');
const auth = require('../../middlewares/authMiddleware');
const roleMiddleware = require('../../middlewares/roleMiddleware');

const router = express.Router();
router.use(auth);

router.post('/',roleMiddleware(["admin"]), createLanguage);

router.get('/', getLanguages);

// Central editor: all keys x all languages. Registered before '/:id' routes.
router.get('/translations', roleMiddleware(["admin"]), getAllTranslations);

router.put('/translations', roleMiddleware(["admin"]), saveAllTranslations);

router.put('/:id',roleMiddleware(["admin"]), updateLanguage);

router.delete('/:id',roleMiddleware(["admin"]), deleteLanguage);

module.exports = router;
