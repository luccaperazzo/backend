const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema({
  nombre:          { type: String, required: true },
  apellido:        { type: String, required: true },
  email:           { type: String, required: true, unique: true },
  password:        { type: String, required: true },
  fechaNacimiento: { type: Date,   required: true },
  role:            { type: String, enum: ['cliente', 'entrenador'], default: 'cliente' },

  // Campos exclusivos para entrenadores:
  zona: {
    type: String,
    required: function() { return this.role === 'entrenador'; }
  },
  idiomas: {
    type: [String],
    required: function() { return this.role === 'entrenador'; },
    validate: {
      validator: function(arr) {
        if (this.role !== 'entrenador') return true;
        return Array.isArray(arr) && arr.length > 0;
      },
      message: 'Un entrenador debe indicar al menos un idioma.'
    }
  },

}, { timestamps: true });

// Antes de guardar, encriptar la contraseña
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Comparar contraseña en login
userSchema.methods.comparePassword = function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

module.exports = mongoose.model('User', userSchema);
