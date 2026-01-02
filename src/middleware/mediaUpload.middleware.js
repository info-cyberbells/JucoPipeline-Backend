import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure upload directories exist
const ensureDir = (dir) => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
};

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    let dir;
    if (file.fieldname === "videos") {
      dir = "./uploads/videos";
    } else if (file.fieldname === "recommendation") {
      dir = "./uploads/recommendations";
    } else if (file.fieldname === "academicInfo") {
      dir = "./uploads/academicinfo";
    } else {
      dir = "./uploads/documents";
    }
    ensureDir(dir);
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const sanitizedName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniqueSuffix}-${sanitizedName}`);
  },
});

// File filters
const videoFilter = (req, file, cb) => {
  const allowedTypes = /mp4|avi|mov|wmv|flv|mkv/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = file.mimetype.startsWith('video/');

  if (mimetype && extname) {
    return cb(null, true);
  }
  cb(new Error("Only video files are allowed (mp4, avi, mov, wmv, flv, mkv)"));
};

const pdfFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    return cb(null, true);
  }
  cb(new Error("Only PDF files are allowed"));
};

// Video upload
export const uploadVideos = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB per video
  fileFilter: videoFilter,
});

// PDF upload (coach recommendation)
export const uploadPDF = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: pdfFilter,
});