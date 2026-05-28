import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { connectDatabase } from "./config/database";
import { errorHandler, notFound } from "./middleware/errorHandler";
import { authMiddleware } from "./middleware/auth";

// Routes
import authRoutes from "./routes/auth";
import productRoutes from "./routes/admin/products";
import tableRoutes from "./routes/admin/tables";
import orderRoutes from "./routes/admin/orders";
import clientRoutes from "./routes/admin/clients";
import providerRoutes from "./routes/admin/providers";
import cashClosingRoutes from "./routes/admin/cashClosings";
import dailyExpenseRoutes from "./routes/admin/dailyExpenses";
import eventRoutes from "./routes/admin/events";
import reservationRoutes from "./routes/admin/reservations";
import reportRoutes from "./routes/admin/reports";
import dashboardRoutes from "./routes/admin/dashboard";
// Cost module routes
import rawMaterialsRoutes from "./costs/routes/rawMaterials.routes";
import laborOverheadRoutes from "./costs/routes/laborOverhead.routes";
import disposablePacksRoutes from "./costs/routes/disposablePacks.routes";
import recipesRoutes from "./costs/routes/recipes.routes";
import projectionsRoutes from "./costs/routes/projections.routes";
import actualResultsRoutes from "./costs/routes/actualResults.routes";
import inventoryRoutes from "./costs/routes/inventory.routes";
// Inventario diario routes
import inventarioDiarioInsumosRoutes from "./inventario/routes/insumos.routes";
import inventarioDiarioRevisionesRoutes from "./inventario/routes/revisiones.routes";
import inventarioDiarioAlertasRoutes from "./inventario/routes/alertas.routes";
import inventarioDiarioHistorialRoutes from "./inventario/routes/historial.routes";
import inventarioDiarioReportesRoutes from "./inventario/routes/reportes.routes";
import inventarioDiarioStockRoutes from "./inventario/routes/stock.routes";
import publicEventRoutes from "./routes/public/events";
import publicReservationRoutes from "./routes/public/reservations";
import publicEventBookingRoutes from "./routes/public/eventBookings";
import publicDinnerRoutes from "./routes/public/dinnerRegistrations";
import publicMenuRoutes from "./routes/public/menu";
import { applyTimezonePlugin } from "./utils/timezone";

// Must run after all model imports so every schema is patched
applyTimezonePlugin();

const app = express();
const allowedOrigins = env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean);

// Middleware
app.use(cors({
  origin: env.CORS_ORIGIN === "*" ? "*" : allowedOrigins,
  credentials: env.CORS_ORIGIN !== "*",
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Auth (public)
app.use("/api/auth", authRoutes);

// Admin routes (protected)
app.use("/api/admin/products", authMiddleware, productRoutes);
app.use("/api/admin/tables", authMiddleware, tableRoutes);
app.use("/api/admin/orders", authMiddleware, orderRoutes);
app.use("/api/admin/clients", authMiddleware, clientRoutes);
app.use("/api/admin/providers", authMiddleware, providerRoutes);
app.use("/api/admin/expenses", authMiddleware, dailyExpenseRoutes);
app.use("/api/admin/cashclosings", authMiddleware, cashClosingRoutes);
app.use("/api/admin/events", authMiddleware, eventRoutes);
app.use("/api/admin/reservations", authMiddleware, reservationRoutes);
app.use("/api/admin/reports", authMiddleware, reportRoutes);
app.use("/api/admin/dashboard", authMiddleware, dashboardRoutes);
// Cost module
app.use("/api/admin/raw-materials", authMiddleware, rawMaterialsRoutes);
app.use(
  "/api/admin/labor-overhead-params",
  authMiddleware,
  laborOverheadRoutes,
);
app.use("/api/admin/disposable-packs", authMiddleware, disposablePacksRoutes);
app.use("/api/admin/recipes", authMiddleware, recipesRoutes);
app.use("/api/admin/projections", authMiddleware, projectionsRoutes);
app.use("/api/admin/results", authMiddleware, actualResultsRoutes);
app.use("/api/admin/inventory", authMiddleware, inventoryRoutes);
// Inventario diario
app.use("/api/admin/inventario-diario/insumos", authMiddleware, inventarioDiarioInsumosRoutes);
app.use("/api/admin/inventario-diario/revisiones", authMiddleware, inventarioDiarioRevisionesRoutes);
app.use("/api/admin/inventario-diario/alertas", authMiddleware, inventarioDiarioAlertasRoutes);
app.use("/api/admin/inventario-diario/historial", authMiddleware, inventarioDiarioHistorialRoutes);
app.use("/api/admin/inventario-diario/reportes", authMiddleware, inventarioDiarioReportesRoutes);
app.use("/api/admin/inventario-diario/stock", authMiddleware, inventarioDiarioStockRoutes);

// Public routes
app.use("/api/public/events", publicEventRoutes);
app.use("/api/public/menu", publicMenuRoutes);
app.use("/api/public/reservations", publicReservationRoutes);
app.use("/api/public/events", publicEventBookingRoutes);
app.use("/api/public/dinner-registrations", publicDinnerRoutes);

// 404 and error handler
app.use(notFound);
app.use(errorHandler);

// Start server
connectDatabase().then(() => {
  app.listen(env.PORT, () => {
    console.log(`🚀 La Isla Cafe backend running on port ${env.PORT}`);
    console.log(`   Environment: ${env.NODE_ENV}`);
  });
});

export default app;
