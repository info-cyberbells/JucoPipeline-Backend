import express from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { changePassword, deleteProfileImage } from "../controllers/profile.controller.js";
import { validateChangePassword } from "../validation/profile.validation.js";
import { getPlayerProfile, updatePlayerProfile, updatePlayerProfileImage, deletePlayerProfileImage, uploadPlayerVideos, deletePlayerVideo, uploadCoachRecommendation, deleteCoachRecommendation, uploadAcademicInfo, deleteAcademicInfo, addStrength,  removeStrength, addAward, removeAward } from "../controllers/player/player.controller.js";
import { uploadVideos, uploadPDF } from "../middleware/mediaUpload.middleware.js";
import { uploadProfile } from "../middleware/upload.middleware.js";

const router = express.Router();

// Protect all routes with player role
router.use(authenticate, authorizeRoles("player"));

// Driver Dashboard
router.get("/dashboard", (req, res) => {
  res.json({ 
    success: true,
    message: "Player Dashboard Access Granted",
    user: req.user 
  });
});

// Profile
router.get("/profile", getPlayerProfile);
router.patch("/profile", updatePlayerProfile);
router.delete("/profile-image", deleteProfileImage);
router.put("/change-password", validateChangePassword, changePassword);

router.patch("/profile-image", uploadProfile.fields([{ name: "profileImage", maxCount: 1 }]), updatePlayerProfileImage);
router.delete("/profile-image", deletePlayerProfileImage);

// Video management
router.post("/videos",uploadVideos.fields([{ name: "videos", maxCount: 2 }]),uploadPlayerVideos);
router.delete("/videos/:videoId", deletePlayerVideo);

// Coach recommendation
router.post("/recommendation", uploadPDF.fields([{ name: "recommendation", maxCount: 1 }]), uploadCoachRecommendation);
router.delete("/recommendation", deleteCoachRecommendation);

router.post("/academic-info", uploadPDF.fields([{ name: "academicInfo", maxCount: 1 }]), uploadAcademicInfo);
router.delete("/academic-info", deleteAcademicInfo);

// Strengths management
router.post("/strengths", addStrength);
router.delete("/strengths", removeStrength);

// Awards management
router.post("/awards", addAward);
router.delete("/awards", removeAward);

export default router;