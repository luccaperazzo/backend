// routes/payment.js

const express = require("express");
const router = express.Router();
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const bodyParser = require("body-parser");
const auth = require("../middleware/authMiddleware");
const User = require("../models/User");
const Service = require("../models/Service");
const Reserva = require("../models/Reserve");



// Ruta protegida para crear sesión de pago con Stripe Checkout
router.post('/create-checkout-session', auth, async (req, res) => {
  const { serviceId, fechaInicio } = req.body;
  const userId = req.user.userId;

  if (!serviceId || !fechaInicio) {
    return res.status(400).json({ message: "Faltan datos: serviceId o fechaInicio" });
  }

  // 1️⃣ parsear fecha
  const inicioDate = new Date(fechaInicio);
  if (isNaN(inicioDate)) {
    return res.status(400).json({ message: "Formato de fecha/hora inválido" });
  }

  try {
    // 2️⃣ buscar servicio y duración
    const servicio = await Service.findById(serviceId).populate("entrenador", "nombre apellido duracion");
    if (!servicio) return res.status(404).json({ message: "Servicio no encontrado" });

    // 3️⃣ buscar reservas del cliente pendientes/aceptadas
    const existentes = await Reserva.find({
      cliente: userId,
      estado: { $in: ['Pendiente', 'Aceptado'] }
    });

    // 4️⃣ cálculo de intervalo nuevo
    const nuevaInicio = inicioDate;
    const nuevaFin    = new Date(nuevaInicio.getTime() + servicio.duracion * 60000);

    // 5️⃣ comprobar solapamiento
    const conflict = existentes.some(r => {
      const ini = new Date(r.fechaInicio);
      // IMPORTANTE: asegurate que r.duracion esté bien guardada en la reserva
      const fin = new Date(ini.getTime() + (r.duracion || servicio.duracion) * 60000);
      return ini < nuevaFin && fin > nuevaInicio;
    });

    if (conflict) {
      return res.status(400).json({ message: 'Ya tenés otra sesión en ese horario.' });
    }

    // 6️⃣ Buscar al cliente autenticado
    const cliente = await User.findById(userId);
    if (!cliente) {
      return res.status(404).json({ message: "Cliente no encontrado" });
    }

    const trainerName = `${servicio.entrenador.nombre} ${servicio.entrenador.apellido}`;
    const serviceName = servicio.titulo;

    // 7️⃣ Crear un cliente real (customer) en Stripe
    const customer = await stripe.customers.create({
      email: cliente.email,
      name: `${cliente.nombre} ${cliente.apellido}`
    });

    // 8️⃣ Crear la sesión de Stripe con el customer creado
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer: customer.id, // Asociamos el customer real
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${serviceName} por ${trainerName}`
            },
            unit_amount: servicio.precio * 100 // Precio en centavos (Stripe lo requiere así)
          },
          quantity: 1
        }
      ],
      success_url: "http://localhost:3000/success",
      cancel_url: "http://localhost:3000/cancel",
      metadata: {
        serviceId,
        userId,
        fechaInicio,
        cliente: `${cliente.nombre} ${cliente.apellido} <${cliente.email}>`
      }
    });

    // 9️⃣ Devolver la URL de la sesión de pago
    res.json({ url: session.url });
  } catch (err) {
    console.error("Error al crear checkout session:", err);
    res.status(500).json({ message: "Error interno en el pago" });
  }
});

// -------------------------
// WEBHOOK DE STRIPE
// -------------------------
// Esta ruta escucha eventos automáticos desde Stripe
router.post("/webhook", bodyParser.raw({ type: "application/json" }), async (req, res) => {
  const sig = req.headers["stripe-signature"];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error("Error al verificar firma del webhook:", err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    try {
      const { serviceId, userId, fechaInicio } = session.metadata;

      // Se crea la reserva una vez confirmado el pago en Stripe
      // La reserva queda en estado PENDIENTE
      await Reserva.create({
        cliente: userId,
        servicio: serviceId,
        fechaInicio: new Date(fechaInicio)
      });

      console.log("Reserva creada tras pago exitoso");
    } catch (err) {
      console.error("Error al crear reserva desde webhook:", err);
    }
  }

  res.status(200).json({ received: true });
});

module.exports = router;