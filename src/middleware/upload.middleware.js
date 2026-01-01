import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure upload directories exist
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// ============= GENERAL STORAGE CONFIGURATION =============
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dir;
    if (file.fieldname === "profileImage") {
      dir = "./uploads/profiles";
    } else if (file.fieldname === "photoIdDocument") {
      dir = "./uploads/photo-ids";
    } else if (file.fieldname === "videos") {
      dir = "./uploads/videos";
    } else if (file.fieldname === "recommendation") {
      dir = "./uploads/recommendations";
    } else if (file.fieldname === "csvFile") {
      dir = "./uploads/csv";
    } else {
      dir = "./uploads/documents";
    }
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const sanitizedFilename = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitizedFilename}`);
  },
});

// ============= FILE FILTERS =============

// Image filter (for profile images)
const imageFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|gif|webp/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = file.mimetype.startsWith('image/');

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error("Only image files are allowed (jpeg, jpg, png, gif, webp)"));
};

// Image + PDF filter (for profile images and photo IDs)
const imageAndPdfFilter = (req, file, cb) => {
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = file.mimetype === 'application/pdf' || file.mimetype.startsWith('image/');

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error("Only .png, .jpg, .jpeg and .pdf files are allowed"));
};

// Video filter
const videoFilter = (req, file, cb) => {
  const allowedTypes = /mp4|avi|mov|wmv|flv|mkv|webm/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = file.mimetype.startsWith('video/');

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error("Only video files are allowed (mp4, avi, mov, wmv, flv, mkv, webm)"));
};

// PDF only filter
const pdfFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    return cb(null, true);
  }
  cb(new Error("Only PDF files are allowed"));
};

// CSV filter
const csvFilter = (req, file, cb) => {
  const allowedTypes = /csv/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel';

  if (mimetype || extname) {
    return cb(null, true);
  }
  cb(new Error("Only CSV files are allowed"));
};

// ============= MULTER INSTANCES =============

// General upload (images + PDFs) - for auth registration, photo IDs
export const uploadFiles = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: imageAndPdfFilter,
});

// Profile images only
export const uploadProfile = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: imageFilter,
});

// Videos only (for player highlight videos)
export const uploadVideos = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB per video
  fileFilter: videoFilter,
});

// PDF only (for coach recommendations)
export const uploadPDF = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: pdfFilter,
});

// CSV only (for player stats import)
export const uploadCSV = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: csvFilter,
});

// ============= EXPORT DEFAULT FOR BACKWARD COMPATIBILITY =============
export default uploadFiles;