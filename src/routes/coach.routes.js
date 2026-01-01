import express from "express";
import { authenticate } from "../middleware/auth.middleware.js";
import { authorizeRoles } from "../middleware/role.middleware.js";
import { uploadProfile } from "../middleware/upload.middleware.js";
import { getCoachDashboard, getSuggestedProfiles, followUser, unfollowUser, getFollowingList, getFollowersList, checkIfFollowing, getTopPlayers, followTeam, unfollowTeam, getFollowedTeams, checkIfFollowingTeam, getTeamFollowersCount } from "../controllers/coach/coachDashboard.controller.js";
import { getCoachProfile, updateCoachProfile, updateCoachProfileImage, deleteCoachProfileImage, resetPassword, forgotPassword, verifyOtp } from "../controllers/coach/coachProfile.controller.js";
import { validateUpdateCoachProfile, validateResetPassword, validateForgotPassword, validateVerifyOtp } from "../validation/coachProfile.validation.js";
import { getTeamRoster } from "../controllers/teams.controller.js";
import { getPlayerById, getUncommittedPLayer, getTop10PlayersByMetric, getAvailableMetrics, searchPlayersForStatistics } from "../controllers/player/player.controller.js";
import { saveFilter, getMyFilters, deleteFilter } from "../controllers/coach/savedFilter.controller.js";

const router = express.Router();
// Protect all routes with coach role
router.use(authenticate, authorizeRoles("coach"));

// Coach Dashboard
router.get("/dashboard", getCoachDashboard);

// Profile
router.get("/profile", getCoachProfile);
router.patch("/profile", validateUpdateCoachProfile, updateCoachProfile);
router.patch("/profile-image", uploadProfile.fields([{ name: "profileImage", maxCount: 1 }]), updateCoachProfileImage);
router.delete("/profile-image", deleteCoachProfileImage);
// router.put("/change-password", validateChangePassword, changePassword);

router.post("/forgot-password", validateForgotPassword, forgotPassword);
router.post("/verify-otp", validateVerifyOtp, verifyOtp);
router.put("/reset-password", validateResetPassword, resetPassword);

// Get suggested profiles to follow
router.get("/suggestions", getSuggestedProfiles);
router.get("/top-players", getTopPlayers);
router.post("/follow/:userId", followUser);
router.delete("/unfollow/:userId", unfollowUser);
router.get("/following/check/:userId", checkIfFollowing);
// Get following list
router.get("/following", getFollowingList);
// Get followers list
router.get("/followers", getFollowersList);

// Teams Following
router.post("/follow-team/:teamId", followTeam);
router.delete("/unfollow-team/:teamId", unfollowTeam);
router.get("/followed-teams", getFollowedTeams);
router.get("/check-following-team/:teamId", checkIfFollowingTeam);
router.get("/team-followers/:teamId", getTeamFollowersCount); 


// Get followed players stats (for dashboard table)
// router.get("/players/stats", getFollowedPlayersStats);
router.get("/player-profile/:playerId", getPlayerById);
router.get("/player-uncommitted", getUncommittedPLayer);

// Get top 10 players by metric
router.get("/statistics/top-players", getTop10PlayersByMetric);
router.get("/statistics/metrics", getAvailableMetrics);
router.get("/statistics/search", searchPlayersForStatistics);

// Teams
router.get("/team-roster/:teamId", getTeamRoster);

//saved filters
router.post("/save-filter", saveFilter);
router.get("/my-filters", getMyFilters);
router.delete("/delete-filter/:id", deleteFilter);

export default router;