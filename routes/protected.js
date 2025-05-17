const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');


router.get('/private', authMiddleware, (req, res) => {
  res.json({ message: `¡Hola ${req.user.userId}! Estás autenticado ✅` });
});

module.exports = router;