const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const BARRIOS_CABA = [
  "Almagro", "Balvanera", "Barracas", "Belgrano", "Boedo",
  "Caballito", "Chacarita", "Coghlan", "Colegiales", "Constitución",
  "Flores", "Floresta", "La Boca", "La Paternal", "Liniers", "Mataderos",
  "Monserrat", "Monte Castro", "Nueva Pompeya", "Nuñez", "Palermo",
  "Parque Avellaneda", "Parque Chacabuco", "Parque Chas", "Parque Patricios",
  "Puerto Madero", "Recoleta", "Retiro", "Saavedra", "San Cristóbal",
  "San Nicolás", "San Telmo", "Vélez Sarsfield", "Versalles", "Villa Crespo",
  "Villa del Parque", "Villa Devoto", "Villa Gral. Mitre", "Villa Lugano",
  "Villa Luro", "Villa Ortúzar", "Villa Pueyrredón", "Villa Real",
  "Villa Riachuelo", "Villa Santa Rita", "Villa Soldati", "Villa Urquiza"
];

const IDIOMAS_ENUM = ["Español", "Inglés", "Portugués"];


const userSchema = new mongoose.Schema({
  nombre:          { type: String, required: true },
  apellido:        { type: String, required: true },
  email:           { type: String, required: true, unique: true },
  password:        { type: String, required: true },
  fechaNacimiento: { type: Date,   required: true },
  role:            { type: String, enum: ['cliente', 'entrenador'], default: 'cliente' },
  resetToken: String,
  resetTokenExpires: Date,


  // Campos exclusivos para entrenadores:
  zona: {
    type: String,
    enum: BARRIOS_CABA,
    required: function() { return this.role === 'entrenador'; }
  },
  presentacion: {
    type: String,
    required: function() { return this.role === 'entrenador'; },
    minlength: 10,
    maxlength: 500
  },
  idiomas: {
    type: [String],
    enum: IDIOMAS_ENUM,  // 👈 Restringe los valores permitidos
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
