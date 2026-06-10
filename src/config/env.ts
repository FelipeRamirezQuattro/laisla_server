import dotenv from "dotenv";
dotenv.config();

export const env = {
  PORT: parseInt(process.env.PORT || "4000", 10),
  MONGODB_URI:
    process.env.MONGODB_URI || "mongodb://localhost:27017/la-isla-cafe",
  JWT_SECRET: process.env.JWT_SECRET || "default_secret_change_me",
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",
  CORS_ORIGIN: process.env.CORS_ORIGIN || "*",
  API_BASE_PATHS: process.env.API_BASE_PATHS || "/api",
  NODE_ENV: process.env.NODE_ENV || "development",
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID || "",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET || "",
  GOOGLE_GMAIL_REDIRECT_URI: process.env.GOOGLE_GMAIL_REDIRECT_URI || "",
  FRONTEND_URL: process.env.FRONTEND_URL || "http://localhost:5173",
  EMAIL_FROM: process.env.EMAIL_FROM || "",
  EMAIL_PASSWORD: process.env.EMAIL_PASSWORD || "",
  EMAIL_LOG_ONLY: process.env.EMAIL_LOG_ONLY === "true",
};
