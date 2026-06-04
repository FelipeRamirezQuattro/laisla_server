import mongoose from "mongoose";
import { env } from "./config/env";
import User from "./models/User";
import Product from "./models/Product";
import Table from "./models/Table";
import Event from "./models/Event";

async function seed() {
  await mongoose.connect(env.MONGODB_URI);
  console.log("✅ Connected to MongoDB");

  // Clear existing data
  await Promise.all([
    User.deleteMany({}),
    Product.deleteMany({}),
    Table.deleteMany({}),
    Event.deleteMany({}),
  ]);
  console.log("🗑️  Cleared existing seed data");

  // Admin user
  const admin = await User.create({
    name: "Administrador",
    email: "admin@laislacafepicnic.com",
    password: "admin123",
    role: "superadmin",
    isActive: true,
  });
  console.log("👤 Admin user created:", admin.email);

  // Products
  const products = await Product.insertMany([
    {
      name: "Espresso Doble",
      description:
        "Dos shots de espresso de origen único — notas de chocolate oscuro y caramelo",
      price: 8000,
      category: "coffee",
      stock: 999,
      isActive: true,
    },
    {
      name: "Cappuccino Artesanal",
      description: "Espresso con leche vaporizada texturizada y arte latte",
      price: 12000,
      category: "coffee",
      stock: 999,
      isActive: true,
    },
    {
      name: "Tostada de Aguacate",
      description:
        "Pan artesanal con aguacate, sal marina, limón y semillas de girasol",
      price: 18000,
      category: "food",
      stock: 20,
      isActive: true,
    },
    {
      name: "Paquete Work Café (4h)",
      description:
        "Puesto de trabajo por 4 horas + bebida de bienvenida + WiFi dedicado",
      price: 35000,
      category: "work-cafe",
      stock: 8,
      isActive: true,
    },
    {
      name: "Experiencia de Cata",
      description:
        "Tour sensorial por 3 orígenes de café colombiano — incluye maridaje",
      price: 45000,
      category: "experience",
      stock: 12,
      isActive: true,
    },
  ]);
  console.log("☕ Products created:", products.length);

  // Tables
  const tables = await Table.insertMany([
    { name: "Mesa Social 1", capacity: 4, zone: "social", status: "available" },
    { name: "Mesa Social 2", capacity: 6, zone: "social", status: "available" },
    {
      name: "Estación Work 1",
      capacity: 2,
      zone: "work-cafe",
      status: "available",
    },
    {
      name: "Rincón Experiencias",
      capacity: 8,
      zone: "experience",
      status: "available",
    },
  ]);
  console.log("🪑 Tables created:", tables.length);

  // Future dates for events
  const in2weeks = new Date();
  in2weeks.setDate(in2weeks.getDate() + 14);

  const in3weeks = new Date();
  in3weeks.setDate(in3weeks.getDate() + 21);

  // Events
  const events = await Event.insertMany([
    {
      title: "Cine Bajo las Estrellas: Amélie",
      description:
        "Una noche mágica viendo la película Amélie en nuestro jardín, con café de especialidad y bocadillos artesanales.",
      type: "movie",
      date: in2weeks,
      time: "19:00",
      pricePerPerson: 25000,
      maxCapacity: 20,
      currentRegistrations: 5,
      isPublished: true,
      status: "upcoming",
    },
    {
      title: "Cena con Desconocidos — Marzo",
      description:
        "Llegarás a cenar con 5 personas que no conoces pero con quienes tienes más en común de lo que crees. Una experiencia única de conexión humana.",
      type: "dinner-with-strangers",
      date: in3weeks,
      time: "19:30",
      pricePerPerson: 65000,
      maxCapacity: 24,
      currentRegistrations: 0,
      isPublished: true,
      status: "upcoming",
    },
  ]);
  console.log("🎉 Events created:", events.length);

  console.log("\n✨ Seed completado exitosamente!");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("Admin: admin@laislacafepicnic.com / admin123");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

  await mongoose.disconnect();
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed error:", err);
  process.exit(1);
});
