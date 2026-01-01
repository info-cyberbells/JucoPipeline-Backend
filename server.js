import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./src/config/db.js";
import authRoutes from "./src/routes/auth.routes.js";
import superAdminRoutes from "./src/routes/super-admin.routes.js";
import coachRoutes from "./src/routes/coach.routes.js";
import scoutRoutes from "./src/routes/scout.routes.js";
import playerRoutes from "./src/routes/player.routes.js";
import csvImportRoutes from "./src/routes/csvImport.routes.js";
import paymentRoutes from "./src/routes/payment.routes.js";
import webhookRoutes from "./src/routes/webhook.routes.js";
import paypalRoutes from "./src/routes/paypal.routes.js";
import paypalWebhookRoutes from "./src/routes/paypal-webhook.routes.js";
import { cleanupOldPendingRegistrations } from "./src/utils/cleanupPendingRegistrations.js";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();
cleanupOldPendingRegistrations();

const app = express();

// ============= CORS CONFIGURATION =============
// app.use(cors({
//     origin: process.env.FRONTEND_URL || "http://localhost:3000",
//     methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
//     credentials: true,
// }));
const allowedOrigins = [
  process.env.FRONTEND_URL,
  process.env.FRONTEND_URL_LIVE
];

app.use(cors({
  origin: function (origin, callback) {
    // allow requests with no origin (Postman, mobile apps)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
  credentials: true,
}));



// ============= WEBHOOK ROUTES (BEFORE BODY PARSERS) =============
// These must come before express.json() because they need raw body
app.use("/api/webhook", webhookRoutes);
app.use("/api/webhook/paypal", paypalWebhookRoutes);

// ============= BODY PARSERS =============
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));

// ============= COOKIE PARSER =============
app.use(cookieParser());

// ============= STATIC FILES =============
// Serve uploaded files publicly
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ============= API ROUTES =============
app.use("/api/auth", authRoutes);
app.use("/api/superAdmin", superAdminRoutes);
app.use("/api/scout", scoutRoutes);
app.use("/api/coach", coachRoutes);
app.use("/api/player", playerRoutes);
app.use("/api/csv", csvImportRoutes);
app.use("/api/payment", paymentRoutes);
app.use("/api/payment", paypalRoutes);

// ============= GLOBAL ERROR HANDLER =============
app.use((err, req, res, next) => {
    console.error("Error:", err);
    
    // Multer errors
    if (err.name === "MulterError") {
        if (err.code === "LIMIT_FILE_SIZE") {
            return res.status(400).json({ 
                message: "File too large. Maximum size allowed is 10MB" 
            });
        }
        if (err.code === "LIMIT_FILE_COUNT") {
            return res.status(400).json({ 
                message: "Too many files uploaded" 
            });
        }
        if (err.code === "LIMIT_UNEXPECTED_FILE") {
            return res.status(400).json({ 
                message: "Unexpected field in file upload" 
            });
        }
        return res.status(400).json({ message: err.message });
    }
    
    // Custom file filter errors
    if (err.message && (
        err.message.includes("Only .png, .jpg") || 
        err.message.includes("Only image files") ||
        err.message.includes("Only PDF files") ||
        err.message.includes("Only video files") ||
        err.message.includes("Only CSV files")
    )) {
        return res.status(400).json({ message: err.message });
    }
    
    // JWT errors
    if (err.name === "JsonWebTokenError") {
        return res.status(401).json({ message: "Invalid token" });
    }
    
    if (err.name === "TokenExpiredError") {
        return res.status(401).json({ message: "Token expired" });
    }
    
    // Mongoose validation errors
    if (err.name === "ValidationError") {
        const errors = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({ 
            message: "Validation error", 
            errors 
        });
    }
    
    // Mongoose duplicate key error
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        return res.status(400).json({ 
            message: `${field} already exists` 
        });
    }
    
    // Default error
    res.status(err.status || 500).json({ 
        message: err.message || "Internal server error" 
    });
});

// ============= 404 HANDLER =============
app.use((req, res) => {
    res.status(404).json({ 
        message: "Route not found",
        path: req.originalUrl 
    });
});

// ============= START SERVER =============
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Frontend URL: ${process.env.FRONTEND_URL || 'http://localhost:3000'}`);
});