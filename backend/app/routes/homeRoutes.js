const express = require('express');
const {
  getHome,
} = require('../controllers/homeController');
const auth = require('@middlewares/authMiddleware');

const router = express.Router();
router.use(auth);

router.get('/', getHome);

module.exports = router;
