// backend/routes/protegida.js
const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');

// Ruta protegida (solo usuarios autenticados pueden acceder)
router.get('/privada', authMiddleware, (req, res) => {
  res.json({ message: `¡Hola ${req.user.userId}! Estás autenticado ✅` });
});

module.exports = router;