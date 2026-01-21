import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import TokenBlacklist from "../models/tokenBlacklist.model.js";
import crypto from "crypto";
import sgMail from "@sendgrid/mail";
sgMail.setApiKey(process.env.SENDGRID_API_KEY);
import mongoose from "mongoose";
import Team from "../models/team.model.js";
import outseta from "../config/outseta.config.js";

import PendingRegistration from "../models/pendingRegistration.model.js";
import Subscription from "../models/subscription.model.js";
import stripe, { SUBSCRIPTION_PLANS } from "../config/stripe.js";
import { PAYPAL_SUBSCRIPTION_PLANS, paypalAPI } from "../config/paypal.config.js";
import { createAdminNotification } from "../utils/adminNotification.js";

// Helper function to generate base URL
const getBaseURL = (req) => `${req.protocol}://${req.get("host")}`;

// Helper function to format user data
const formatUserData = (user, baseURL) => {
  const userData = user.toObject();

  // Format profile image
  if (userData.profileImage && !userData.profileImage.startsWith("http")) {
    userData.profileImage = `${baseURL}${userData.profileImage}`;
  }

  // Format photoIdDocument (single object)
  if (userData.photoIdDocument && userData.photoIdDocument.documentUrl) {
    if (!userData.photoIdDocument.documentUrl.startsWith("http")) {
      userData.photoIdDocument.documentUrl = `${baseURL}${userData.photoIdDocument.documentUrl}`;
    }
  }

  // Format photoIdDocuments array (if keeping for history)
  if (userData.photoIdDocuments && userData.photoIdDocuments.length > 0) {
    userData.photoIdDocuments = userData.photoIdDocuments.map(doc => ({
      ...doc,
      documentUrl: doc.documentUrl.startsWith("http") ? doc.documentUrl : `${baseURL}${doc.documentUrl}`
    }));
  }

  delete userData.password;
  return userData;
};

export const getUSStates = async (req, res) => {
  try {
    // Dynamic import
    const { default: usStates } = await import('../../data/usStates.json', {
      with: { type: 'json' }
    });

    res.json({
      success: true,
      data: usStates
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// Step 1: Player Registration
export const registerPlayer = async (req, res) => {
  try {
    let { firstName, lastName, email, phoneNumber, teamId, ncaaId, xURL, instaURL } = req.body;

    // Validate required fields
    if (!firstName || !lastName) {
      return res.status(400).json({
        message: "First name and last name are required"
      });
    }

    // Validate ID proof upload (REQUIRED)
    if (!req.files?.photoIdDocument || req.files.photoIdDocument.length === 0) {
      return res.status(400).json({
        message: "ID document is required for registration"
      });
    }

    // Normalize empty email → null
    if (!email || email.trim() === "") {
      email = null;
    }

    // Validate teamId if provided
    if (teamId) {
      if (!mongoose.Types.ObjectId.isValid(teamId)) {
        return res.status(400).json({ message: "Invalid team ID format" });
      }

      const teamExists = await Team.findById(teamId);
      if (!teamExists) {
        return res.status(400).json({ message: "Team not found" });
      }
    }

    // Build query for existing player
    const query = {
      firstName: { $regex: new RegExp(`^${firstName.trim()}$`, 'i') },
      lastName: { $regex: new RegExp(`^${lastName.trim()}$`, 'i') },
      role: "player"
    };

    if (teamId) {
      query.team = teamId;
    }

    // Check if player already exists
    const existingPlayer = await User.findOne(query);

    // Prepare photo ID document data
    const photoIdDocumentUrl = `/uploads/photo-ids/${req.files.photoIdDocument[0].filename}`;
    const photoIdDocumentData = {
      documentUrl: photoIdDocumentUrl,
      uploadedAt: new Date(),
      ipAddress: req.ip || req.connection.remoteAddress,
      userAgent: req.headers['user-agent']
    };

    let player;
    if (existingPlayer) {
      existingPlayer.email = email || existingPlayer.email;
      existingPlayer.phoneNumber = phoneNumber || existingPlayer.phoneNumber;
      existingPlayer.registrationStatus = "inProgress";
      existingPlayer.photoIdDocument = photoIdDocumentData;
      existingPlayer.xURL = xURL;
      existingPlayer.instaURL = instaURL;

      if (teamId) {
        existingPlayer.team = teamId;
      }

      if (ncaaId && !existingPlayer.ncaaId) {
        existingPlayer.ncaaId = ncaaId;
      }

      await existingPlayer.save();
      player = existingPlayer;

    } else {
      // Create new player
      const playerData = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email,
        phoneNumber,
        role: "player",
        registrationStatus: "inProgress",
        ncaaId:ncaaId, 
        xURL:xURL, 
        instaURL:instaURL, 
        photoIdDocument: photoIdDocumentData
      };

      if (teamId) {
        playerData.team = teamId;
      }

      player = await User.create(playerData);
    }

    // Populate team data
    await player.populate('team', 'name logo location division');

    // SuperAdmin Notification
    await createAdminNotification({
      title: "New Player Registration",
      message: `${player.getFullName()} has submitted registration for approval.`,
      type: "PLAYER_REGISTRATION",
      referenceId: player._id
    });

    // Format data
    const baseURL = getBaseURL(req);
    const playerData = formatUserData(player, baseURL);

    res.status(201).json({
      message: existingPlayer ? "Player updated successfully and pending approval." : "Player registered successfully and pending approval.",
      player: playerData,
      status: player.registrationStatus
    });

  } catch (err) {
    console.error("Register Player Error:", err);
    res.status(500).json({ message: err.message });
  }
};

// Step 2: Get all teams (for dropdown)
export const getTeamsWithOutPagination = async (req, res) => {
  try {
    const baseURL = `${req.protocol}://${req.get("host")}`;
    const teams = await Team.find().sort({ name: 1 }); // Sort by name A-Z
    // Get player count for each team
    const teamsWithCount = await Promise.all(
      teams.map(async (team) => {
        const playerCount = await User.countDocuments({
          team: team._id,
          role: "player",
          registrationStatus: "approved",
          isActive: true
        });

        const teamData = team.toObject();

        // Format logo URL
        if (teamData.logo && !teamData.logo.startsWith("http")) {
          teamData.logo = `${baseURL}${teamData.logo}`;
        }

        return {
          ...teamData,
          playerCount
        };
      })
    );

    res.json({
      message: "Teams retrieved successfully",
      teams: teamsWithCount,
      totalTeams: teamsWithCount.length
    });
  } catch (error) {
    console.error("Get All Teams Error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getTeamsWithPagination = async (req, res) => {
  try {
    const baseURL = `${req.protocol}://${req.get("host")}`;

    // pagination params
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // total teams count
    const totalTeams = await Team.countDocuments();

    // paginated teams
    const teams = await Team.find()
      .sort({ name: 1 }) // A-Z
      .skip(skip)
      .limit(limit);

    // Get player count for each team
    const teamsWithCount = await Promise.all(
      teams.map(async (team) => {
        const playerCount = await User.countDocuments({
          team: team._id,
          role: "player",
          registrationStatus: "approved",
          isActive: true
        });

        const teamData = team.toObject();

        // Format logo URL
        if (teamData.logo && !teamData.logo.startsWith("http")) {
          teamData.logo = `${baseURL}${teamData.logo}`;
        }

        return {
          ...teamData,
          playerCount
        };
      })
    );

    res.json({
      message: "Teams retrieved successfully",
      teams: teamsWithCount,
      pagination: {
        totalTeams,
        totalPages: Math.ceil(totalTeams / limit),
        currentPage: page,
        limit
      }
    });
  } catch (error) {
    console.error("Get All Teams Error:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getTeams = async (req, res) => {
  try {
    const baseURL = `${req.protocol}://${req.get("host")}`;

    // pagination params
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // search param
    const { teamName } = req.query;

    // build filter
    const filter = {};
    if (teamName) {
      filter.name = { $regex: teamName, $options: "i" }; // case-insensitive search
    }

    // total teams count (with search)
    const totalTeams = await Team.countDocuments(filter);

    // paginated teams (with search)
    const teams = await Team.find(filter)
      .sort({ name: 1 }) // A-Z
      .skip(skip)
      .limit(limit);

    // Get player count for each team
    const teamsWithCount = await Promise.all(
      teams.map(async (team) => {
        const playerCount = await User.countDocuments({
          team: team._id,
          role: "player",
          registrationStatus: "approved",
          isActive: true
        });

        const teamData = team.toObject();

        // Format logo URL
        if (teamData.logo && !teamData.logo.startsWith("http")) {
          teamData.logo = `${baseURL}${teamData.logo}`;
        }

        return {
          ...teamData,
          playerCount
        };
      })
    );

    res.json({
      message: "Teams retrieved successfully",
      teams: teamsWithCount,
      pagination: {
        totalTeams,
        totalPages: Math.ceil(totalTeams / limit),
        currentPage: page,
        limit
      }
    });
  } catch (error) {
    console.error("Get All Teams Error:", error);
    res.status(500).json({ message: error.message });
  }
};


// GET TEAM BY ID
export const getTeamById = async (req, res) => {
  try {
    const { teamId } = req.params;
    const { page = 1, limit = 1000 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(teamId)) {
      return res.status(400).json({ message: "Invalid team ID format" });
    }

    const baseURL = `${req.protocol}://${req.get("host")}`;

    // Check if team exists
    const team = await Team.findById(teamId);
    if (!team) {
      return res.status(400).json({ message: "Team not found" });
    }

    // Simple filter - only team and role
    const filter = {
      team: teamId,
      role: "player"
    };

    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Get players with limited fields
    const [players, totalCount] = await Promise.all([
      User.find(filter)
        .select("firstName lastName email profileImage position jerseyNumber")
        .sort({ firstName: 1 })
        .skip(skip)
        .limit(parseInt(limit)),
      User.countDocuments(filter)
    ]);

    // Format players with minimal data
    const formattedPlayers = players.map(player => {
      const userData = player.toObject();

      // Format profile image
      if (userData.profileImage && !userData.profileImage.startsWith("http")) {
        userData.profileImage = `${baseURL}${userData.profileImage}`;
      }

      return {
        _id: userData._id,
        name: `${userData.firstName} ${userData.lastName}`,
        email: userData.email,
        profileImage: userData.profileImage,
        position: userData.position || "N/A",
        jerseyNumber: userData.jerseyNumber || "N/A"
      };
    });

    // Format team logo
    const teamData = team.toObject();
    if (teamData.logo && !teamData.logo.startsWith("http")) {
      teamData.logo = `${baseURL}${teamData.logo}`;
    }

    res.json({
      message: "Players retrieved successfully",
      team: teamData,
      players: formattedPlayers,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / parseInt(limit)),
        totalCount,
        limit: parseInt(limit),
        hasMore: skip + formattedPlayers.length < totalCount
      }
    });
  } catch (error) {
    console.error("Get Players By Team Error:", error);
    res.status(500).json({ message: error.message });
  }
};

// Step 4: Player Login (Passwordless with Photo ID)
export const loginPlayer = async (req, res) => {
  try {
    const { teamId, playerName, email } = req.body;

    // Validate required fields
    if (!email || email.trim() === "") {
      return res.status(400).json({ message: "Email is required" });
    }

    if (!playerName || playerName.trim() === "") {
      return res.status(400).json({ message: "Player name is required" });
    }

    // Parse player name
    const nameParts = playerName.trim().split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';
    if (!firstName) {
      return res.status(400).json({ message: "Invalid player name format" });
    }

    // Build query to find player by name and team
    const query = {
      firstName: { $regex: new RegExp(`^${firstName}$`, 'i') },
      role: "player"
    };

    if (lastName) {
      query.lastName = { $regex: new RegExp(`^${lastName}$`, 'i') };
    }

    if (teamId) {
      if (!mongoose.Types.ObjectId.isValid(teamId)) {
        return res.status(400).json({ message: "Invalid team ID format" });
      }
      query.team = teamId;
    }

    // Find player
    const player = await User.findOne(query).populate('team', 'name logo location division');
    if (!player) {
      return res.status(400).json({
        status: false,
        message: "Player not found. Please check your team and name."
      });
    }

    // Verify player name matches (case-insensitive)
    const fullName = player.getFullName();
    if (fullName.toLowerCase() !== playerName.toLowerCase().trim()) {
      return res.status(400).json({
        status: false,
        message: "Invalid credentials. Player name does not match."
      });
    }

    // HANDLE CSV IMPORTED PLAYER
    if (!player.email || player.email === null) {
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          status: false,
          message: "Please provide a valid email address"
        });
      }

      // Check if email is already taken by another user
      const emailExists = await User.findOne({
        email: email.toLowerCase(),
        _id: { $ne: player._id }
      });

      if (emailExists) {
        return res.status(400).json({
          status: false,
          message: "This email is already registered with another account"
        });
      }

      // Update player email
      player.email = email.toLowerCase();
      player.registrationStatus = "inProgress";
      await player.save();

      // SuperAdmin Notification
      await createAdminNotification({
        title: "Player Claimed Profile",
        message: `${player.getFullName()} has claimed their profile and is pending verification.`,
        type: "PLAYER_LOGIN_CLAIM",
        referenceId: player._id
      });

      return res.status(200).json({
        status: true,
        message: "Your registration is currently in progress. Please wait while we verify your information.",
        playerName: player.getFullName(),
        email: player.email,
        team: player.team?.name,
        registrationStatus: player.registrationStatus
      });
    }

    // ============= HANDLE REGISTERED PLAYER (HAS EMAIL) =============

    // Check if the provided email matches player's email
    if (player.email.toLowerCase() !== email.toLowerCase()) {
      return res.status(400).json({
        status: false,
        message: "Email does not match our records"
      });
    }

    // Check registration status
    if (player.registrationStatus === "inProgress") {
      return res.status(403).json({
        status: false,
        registrationStatus: "inProgress",
        message: "Your registration is currently in progress. Please wait for verification."
      });
    }

    if (player.registrationStatus === "pending") {
      return res.status(403).json({
        status: false,
        registrationStatus: "pending",
        message: "Your registration is pending admin approval. Please wait for verification."
      });
    }

    if (player.registrationStatus === "rejected") {
      return res.status(403).json({
        status: false,
        registrationStatus: "rejected",
        message: "Your registration has been rejected.",
        reason: player.rejectionReason
      });
    }

    // Check if account is active
    if (!player.isActive) {
      return res.status(403).json({
        status: false,
        message: "Your account has been deactivated. Please contact support."
      });
    }

    if (player.registrationStatus === "approved") {
      return res.status(200).json({
        status: true,
        registrationStatus: "approved",
        message: "Your account is already set up. Please use the regular login with your email and password.",
      });
    }

  } catch (err) {
    console.error("Login Player Error:", err);
    res.status(500).json({
      status: false,
      message: err.message
    });
  }
};
// ============= ADMIN ACTIONS =============

// Admin approves player
export const approvePlayer = async (req, res) => {
  try {
    const { playerId } = req.params;
    const adminId = req.user.id;

    const player = await User.findById(playerId);
    if (!player || player.role !== "player") {
      return res.status(400).json({ message: "Player not found" });
    }

    if (player.registrationStatus === "approved") {
      return res.status(400).json({ message: "Player already approved" });
    }

    player.registrationStatus = "approved";
    player.approvedBy = adminId;
    player.approvedAt = new Date();
    await player.save();

    // Send approval email
    await sendApprovalEmail(player);

    const baseURL = getBaseURL(req);
    const playerData = formatUserData(player, baseURL);

    res.json({
      message: "Player approved successfully. Approval email sent.",
      player: playerData
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Admin rejects player
export const rejectPlayer = async (req, res) => {
  try {
    const { playerId } = req.params;
    const { reason } = req.body;

    const player = await User.findById(playerId);
    if (!player || player.role !== "player") {
      return res.status(400).json({ message: "Player not found" });
    }

    player.registrationStatus = "rejected";
    player.rejectionReason = reason || "Not specified";
    await player.save();

    res.json({
      message: "Player registration rejected",
      player: formatUserData(player, getBaseURL(req))
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Get all pending players
export const getPendingPlayers = async (req, res) => {
  try {
    const players = await User.find({
      role: "player",
      registrationStatus: "pending"
    }).select("-password");

    const baseURL = getBaseURL(req);
    const formattedPlayers = players.map(p => formatUserData(p, baseURL));

    res.json({ players: formattedPlayers });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Regular registration for scout/coach
export const register = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, teamId, jobTitle, school, division, conference, state } = req.body;
    // console.log('req.body',req.body);
    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "User already exists" });
    }

    if (role === "superAdmin") {
      return res.status(403).json({ message: "Cannot assign superAdmin role" });
    }

    if (role === "player") {
      return res.status(400).json({
        message: "Players must use the player registration endpoint"
      });
    }

    const profileImage = req.files?.profileImage ? `/uploads/profiles/${req.files.profileImage[0].filename}` : null;
    const userData = { firstName, lastName, email, password, role, state, profileImage, registrationStatus: "approved" };
    // Role-specific fields
    if (role === "scout") {
      userData.team = teamId;
      userData.jobTitle = jobTitle;
    } else if (role === "coach") {
      userData.school = school;
      userData.division = division;
      userData.conference = conference;
    }

    const user = await User.create(userData);

    const baseURL = getBaseURL(req);
    const formattedUser = formatUserData(user, baseURL);

    // SuperAdmin Notifications
    await createAdminNotification({
      title: "New User Registered",
      message: `${role.toUpperCase()} ${user.firstName} ${user.lastName} registered successfully.`,
      type: "USER_REGISTRATION",
      referenceId: user._id,
      createdBy: user._id
    });

    res.status(201).json({
      message: `${role} registered successfully`,
      user: formattedUser
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// ============================================
// Register with Payment Intent
// ============================================
export const registerWithPaymentOLLDDDDD = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();
    const { firstName, lastName, email, password, role, teamId, jobTitle, school, division, conference, state, paymentProvider, plan } = req.body;

    // Validation
    if (!["scout", "coach"].includes(role)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid role. Only scout or coach allowed."
      });
    }

    if (!paymentProvider || !["stripe", "paypal"].includes(paymentProvider)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Payment provider required (stripe or paypal)"
      });
    }

    if (!plan) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Subscription plan required"
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email }).session(session);
    if (existingUser) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "User already exists"
      });
    }

    // Check pending registration
    const existingPending = await PendingRegistration.findOne({ email }).session(session);
    if (existingPending) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Registration already in progress. Please complete payment or try again later."
      });
    }

    // Verify plan matches role
    const planRole = plan.startsWith("coach") ? "coach" : "scout";
    if (role !== planRole) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: `Plan ${plan} is for ${planRole}s only`
      });
    }

    // Hash password
    // const hashedPassword = await bcrypt.hash(password, 10);

    // Profile image
    const profileImage = req.files?.profileImage ? `/uploads/profiles/${req.files.profileImage[0].filename}` : null;

    // Create pending registration data
    const pendingData = {
      firstName,
      lastName,
      email,
      password,
      role,
      state,
      profileImage,
      paymentProvider,
      plan,
      status: "pending_payment"
    };

    // Role-specific fields
    if (role === "scout") {
      pendingData.teamId = teamId;
      pendingData.jobTitle = jobTitle;
    } else if (role === "coach") {
      pendingData.school = school;
      pendingData.division = division;
      pendingData.conference = conference;
    }

    // Create pending registration
    const [pendingReg] = await PendingRegistration.create([pendingData], { session });

    let paymentResponse;

    // ============================================
    // Handle Stripe Payment
    // ============================================
    if (paymentProvider === "stripe") {
      const planConfig = SUBSCRIPTION_PLANS[plan];

      if (!planConfig) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Invalid Stripe plan"
        });
      }

      // Create Stripe customer
      const customer = await stripe.customers.create({
        email: email,
        name: `${firstName} ${lastName}`,
        metadata: {
          pendingRegistrationId: pendingReg._id.toString(),
          role: role,
          plan: plan
        }
      });

      // Create Checkout Session
      const checkoutSession = await stripe.checkout.sessions.create({
        customer: customer.id,
        payment_method_types: ["card"],
        mode: "subscription",
        line_items: [{
          price: planConfig.priceId,
          quantity: 1
        }],
        success_url: `${process.env.FRONTEND_URL}/registration/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/registration/cancel?session_id={CHECKOUT_SESSION_ID}&provider=stripe`,
        metadata: {
          pendingRegistrationId: pendingReg._id.toString(),
          plan: plan,
          role: role
        },
        subscription_data: {
          metadata: {
            pendingRegistrationId: pendingReg._id.toString(),
            plan: plan
          }
        }
      });

      // Update pending registration
      pendingReg.stripeCustomerId = customer.id;
      pendingReg.stripeSessionId = checkoutSession.id;
      await pendingReg.save({ session });

      paymentResponse = {
        sessionId: checkoutSession.id,
        sessionUrl: checkoutSession.url,
        customerId: customer.id
      };
    }

    // ============================================
    // Handle PayPal Payment
    // ============================================
    else if (paymentProvider === "paypal") {
      const planConfig = PAYPAL_SUBSCRIPTION_PLANS[plan];

      if (!planConfig) {
        await session.abortTransaction();
        return res.status(400).json({
          success: false,
          message: "Invalid PayPal plan"
        });
      }

      const subscriptionData = {
        plan_id: planConfig.planId,
        application_context: {
          brand_name: "JucoPipeline",
          locale: "en-US",
          shipping_preference: "NO_SHIPPING",
          user_action: "SUBSCRIBE_NOW",
          payment_method: {
            payer_selected: "PAYPAL",
            payee_preferred: "IMMEDIATE_PAYMENT_REQUIRED"
          },
          return_url: `${process.env.FRONTEND_URL}/registration/success?provider=paypal&subscription_id=${pendingReg._id}`,
          cancel_url: `${process.env.FRONTEND_URL}/registration/cancel?provider=paypal&subscription_id=${pendingReg._id}`
        },
        custom_id: pendingReg._id.toString()
      };

      const subscription = await paypalAPI("/v1/billing/subscriptions", {
        method: "POST",
        body: JSON.stringify(subscriptionData)
      });

      const approvalUrl = subscription.links.find(link => link.rel === "approve")?.href;

      if (!approvalUrl) {
        await session.abortTransaction();
        return res.status(500).json({
          success: false,
          message: "No approval URL from PayPal"
        });
      }

      // Update pending registration
      pendingReg.paypalSubscriptionId = subscription.id;
      await pendingReg.save({ session });

      paymentResponse = {
        sessionId: subscription.id,
        sessionUrl: approvalUrl
      };
    }

    await session.commitTransaction();

    res.status(201).json({
      success: true,
      message: "Registration initiated. Please complete payment.",
      pendingRegistrationId: pendingReg._id,
      paymentProvider,
      payment: paymentResponse,
      plan: {
        name: paymentProvider === "stripe"
          ? SUBSCRIPTION_PLANS[plan].name
          : PAYPAL_SUBSCRIPTION_PLANS[plan].name,
        price: paymentProvider === "stripe"
          ? SUBSCRIPTION_PLANS[plan].price
          : PAYPAL_SUBSCRIPTION_PLANS[plan].price,
        interval: paymentProvider === "stripe"
          ? SUBSCRIPTION_PLANS[plan].interval
          : PAYPAL_SUBSCRIPTION_PLANS[plan].interval
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error("Register with Payment Error:", error);
    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message
    });
  } finally {
    session.endSession();
  }
};


export const registerWithPaymentPAYMENT = async (req, res) => {
  let pendingReg = null;
  let outsetaPerson = null;

  try {
    const {
      firstName,
      lastName,
      email,
      password,
      role,
      teamId,
      jobTitle,
      school,
      division,
      conference,
      state,
      plan
    } = req.body;

    // ============================================
    // VALIDATION
    // ============================================
    if (!["scout", "coach"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Only scout or coach allowed."
      });
    }

    if (!plan) {
      return res.status(400).json({
        success: false,
        message: "Subscription plan required"
      });
    }

    // ============================================
    // CHECK EXISTING USER (No transaction)
    // ============================================
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "User already exists"
      });
    }

    // Check pending registration
    const existingPending = await PendingRegistration.findOne({ email });
    if (existingPending) {
      // If existing pending is old (>1 hour), delete it
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (existingPending.createdAt < oneHourAgo) {
        await PendingRegistration.findByIdAndDelete(existingPending._id);
        console.log(`🧹 Cleaned up old pending registration for ${email}`);
      } else {
        return res.status(400).json({
          success: false,
          message: "Registration already in progress. Please complete payment or try again later."
        });
      }
    }

    // ============================================
    // VALIDATE PLAN FROM OUTSETA
    // ============================================
    let planDetails;
    // try {
    planDetails = await outseta.getPlan(plan);
    console.log(`✅ Plan validated: ${planDetails.Name}`);
    // } catch (error) {
    //   return res.status(400).json({
    //     success: false,
    //     message: "Invalid subscription plan"
    //   });
    // }

    // Profile image
    const profileImage = req.files?.profileImage
      ? `/uploads/profiles/${req.files.profileImage[0].filename}`
      : null;

    // ============================================
    // CREATE PENDING REGISTRATION FIRST
    // ============================================
    const pendingData = {
      firstName,
      lastName,
      email,
      password,
      role,
      state,
      profileImage,
      paymentProvider: "outseta",
      plan: plan,
      status: "pending_payment"
    };

    // Role-specific fields
    if (role === "scout") {
      pendingData.teamId = teamId;
      pendingData.jobTitle = jobTitle;
    } else if (role === "coach") {
      pendingData.school = school;
      pendingData.division = division;
      pendingData.conference = conference;
    }

    pendingReg = await PendingRegistration.create(pendingData);
    console.log(`✅ Pending registration created: ${pendingReg._id}`);

    // ============================================
    // CREATE OUTSETA PERSON
    // ============================================
    try {
      outsetaPerson = await outseta.createOrUpdatePerson({
        email: email,
        firstName: firstName,
        lastName: lastName,
        state: state
      });

      console.log(`✅ Outseta person created: ${outsetaPerson.Uid}`);

      // Update pending registration with Outseta IDs
      pendingReg.outsetaPersonUid = outsetaPerson.Uid;
      pendingReg.outsetaAccountUid = outsetaPerson.Account.Uid;
      await pendingReg.save();

    } catch (error) {
      // Rollback: Delete pending registration
      await PendingRegistration.findByIdAndDelete(pendingReg._id);

      console.error("Error creating Outseta person:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create billing account. Please try again."
      });
    }

    // ============================================
    // CREATE STRIPE CHECKOUT VIA OUTSETA
    // ============================================
    let checkoutSession;
    try {
      checkoutSession = await outseta.createStripeCheckoutSession(
        outsetaPerson.Account.Uid,
        plan,
        `${process.env.FRONTEND_URL}/registration/success?session_id={CHECKOUT_SESSION_ID}&pending_id=${pendingReg._id}`,
        `${process.env.FRONTEND_URL}/registration/cancel?pending_id=${pendingReg._id}`
      );

      console.log(`✅ Checkout session created: ${checkoutSession.id}`);

      // Update pending registration with session ID
      pendingReg.stripeSessionId = checkoutSession.id;
      await pendingReg.save();

    } catch (error) {
      // Rollback: Delete pending registration and Outseta person
      await PendingRegistration.findByIdAndDelete(pendingReg._id);

      console.error("Error creating checkout session:", error);
      return res.status(500).json({
        success: false,
        message: "Failed to create checkout session. Please try again."
      });
    }

    // ============================================
    // SUCCESS RESPONSE
    // ============================================
    res.status(201).json({
      success: true,
      message: "Registration initiated. Please complete payment.",
      pendingRegistrationId: pendingReg._id,
      paymentProvider: "outseta",
      payment: {
        sessionId: checkoutSession.id,
        sessionUrl: checkoutSession.url
      },
      plan: {
        uid: plan,
        name: planDetails.Name,
        price: planDetails.PlanAmount,
        interval: planDetails.BillingRenewalTerm === 12 ? 'year' : 'month'
      }
    });

  } catch (error) {
    console.error("Register with Payment Error:", error);

    // Cleanup on error
    if (pendingReg) {
      try {
        await PendingRegistration.findByIdAndDelete(pendingReg._id);
        console.log('🔄 Cleaned up pending registration');
      } catch (e) {
        console.error("Failed to cleanup pending registration:", e);
      }
    }

    res.status(500).json({
      success: false,
      message: "Registration failed. Please try again.",
      error: error.message
    });
  }
};


export const registerWithPayment = async (req, res) => {
  const session = await mongoose.startSession();

  try {
    await session.startTransaction();

    const {
      firstName,
      lastName,
      email,
      password,
      role,
      teamId,
      jobTitle,
      school,
      division,
      conference,
      state,
      plan
    } = req.body;

    // ===============================
    // Validation
    // ===============================
    if (!["scout", "coach"].includes(role)) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Invalid role. Only scout or coach allowed."
      });
    }

    if (!plan) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Subscription plan required"
      });
    }

    // ===============================
    // Check existing user
    // ===============================
    const existingUser = await User.findOne({ email }).session(session);
    if (existingUser) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "User already exists"
      });
    }

    // ===============================
    // Check pending registration
    // ===============================
    const existingPending = await PendingRegistration.findOne({ email }).session(session);
    if (existingPending) {
      await session.abortTransaction();
      return res.status(400).json({
        success: false,
        message: "Registration already in progress"
      });
    }


    // ===============================
    // Verify plan matches role
    // ===============================
    // const planRole = plan.startsWith("coach") ? "coach" : "scout";
    // if (role !== planRole) {
    //   await session.abortTransaction();
    //   return res.status(400).json({
    //     success: false,
    //     message: `Plan ${plan} is for ${planRole}s only`
    //   });
    // }


    // ===============================
    // Profile image
    // ===============================
    const profileImage = req.files?.profileImage ? `/uploads/profiles/${req.files.profileImage[0].filename}` : null;

    // ===============================
    // Create pending registration
    // ===============================
    const pendingData = {
      firstName,
      lastName,
      email,
      password, // hash later after webhook
      role,
      state,
      profileImage,
      plan,
      status: "pending_payment"
    };

    if (role === "scout") {
      pendingData.teamId = teamId;
      pendingData.jobTitle = jobTitle;
    }

    if (role === "coach") {
      pendingData.school = school;
      pendingData.division = division;
      pendingData.conference = conference;
    }

    const [pendingReg] = await PendingRegistration.create([pendingData], { session });

    await session.commitTransaction();

    // ===============================
    // RESPONSE
    // ===============================
    res.status(201).json({
      success: true,
      message: "Registration started. Please complete payment.",
      pendingRegistrationId: pendingReg._id,
      nextStep: "Complete checkout via Outseta",
      plan
    });

  } catch (error) {
    await session.abortTransaction();
    console.error("Register Error:", error);

    res.status(500).json({
      success: false,
      message: "Registration failed",
      error: error.message
    });
  } finally {
    session.endSession();
  }
};


// ============================================
// Verify Registration Status
// ============================================
export const verifyRegistrationStatus = async (req, res) => {
  try {
    const { pendingRegistrationId, sessionId, subscriptionId } = req.query;

    if (!pendingRegistrationId) {
      return res.status(400).json({
        success: false,
        message: "Pending registration ID required"
      });
    }

    const pendingReg = await PendingRegistration.findById(pendingRegistrationId);

    if (!pendingReg) {
      return res.status(400).json({
        success: false,
        message: "Pending registration not found or expired"
      });
    }

    // Check if already completed
    if (pendingReg.status === "completed") {
      const user = await User.findOne({ email: pendingReg.email });

      return res.json({
        success: true,
        message: "Registration completed",
        status: "completed",
        user: user ? {
          id: user._id,
          email: user.email,
          role: user.role
        } : null
      });
    }

    res.json({
      success: true,
      status: pendingReg.status,
      message: `Registration status: ${pendingReg.status}`
    });

  } catch (error) {
    console.error("Verify Registration Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify registration",
      error: error.message
    });
  }
};

// Regular login for scout/coach/superAdmin
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    // Players cannot use this endpoint
    // if (user.role === "player") {
    //   return res.status(400).json({
    //     message: "Players must use the player login endpoint"
    //   });
    // }

    // Check registration status
    if (user.role !== "superadmin" && user.registrationStatus === "pending") {
      return res.status(403).json({
        message: "Your registration is pending admin approval. Please wait for verification."
      });
    }

    if (user.registrationStatus === "rejected") {
      return res.status(403).json({
        message: "Your registration has been rejected.",
        reason: user.rejectionReason
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid credentials" });
    }

    if (!user.isActive) {
      return res.status(403).json({
        message: "Your account has been deactivated"
      });
    }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const maxAge = 7 * 24 * 60 * 60 * 1000;

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "none",
      maxAge,
    });

    const baseURL = getBaseURL(req);
    const userData = formatUserData(user, baseURL);

    res.json({
      message: "Login successful",
      token,
      user: userData
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Logout
export const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      await TokenBlacklist.create({
        token,
        expiresAt: new Date(decoded.exp * 1000)
      });
    }

    res.clearCookie("token");
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Email helper
const sendApprovalEmail = async (player) => {
  const msg = {
    to: player.email,
    from: process.env.SENDGRID_FROM_EMAIL,
    subject: "Your JucoPipeline Registration Has Been Approved!",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #2c3e50;">Hello ${player.firstName}!</h2>
        <p style="font-size: 16px; line-height: 1.6;">
          Great news! Your registration for JucoPipeline has been approved.
        </p>
        <p style="font-size: 16px; line-height: 1.6;">
          You can now log in to your player profile using your team name, name, email, and photo ID.
        </p>
        <div style="margin: 30px 0;">
          <a href="${process.env.FRONTEND_URL}/player-login" 
             style="background-color: #3498db; color: white; padding: 12px 30px; 
                    text-decoration: none; border-radius: 5px; display: inline-block;">
            Login to Your Profile
          </a>
        </div>
        <p style="font-size: 14px; color: #7f8c8d;">
          If you have any questions, please don't hesitate to contact us.
        </p>
        <p style="font-size: 14px; color: #7f8c8d;">
          Best regards,<br>
          The JucoPipeline Team
        </p>
      </div>
    `
  };

  try {
    await sgMail.send(msg);
  } catch (error) {
    console.error("Email send error:", error);
  }
};

export {
  sendApprovalEmail
};

// Register Driver
export const registerOLLDDDDDDD = async (req, res) => {
  try {
    const { firstName, lastName, email, password, role, phoneNumber } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "Driver already exists" });

    // Prevent role escalation
    if (role === "superAdmin") {
      return res.status(403).json({ message: "You cannot assign this role manually" });
    }

    // let profileImage = null;
    // if (req.file) {
    //   profileImage = `/uploads/profiles/${req.file.filename}`;
    // }

    const profileImage = req.files?.profileImage ? `/uploads/profiles/${req.files.profileImage[0].filename}` : null;

    // Create user with all fields
    const user = await User.create({
      firstName,
      lastName,
      email,
      password,
      role,
      phoneNumber,
      status: "approved"
    });

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const userData = user.toObject();
    if (userData.profileImage && !userData.profileImage.startsWith("http")) {
      userData.profileImage = `${baseURL}${userData.profileImage}`;
    }

    res.status(201).json({ message: "Driver registered successfully", user: userData });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Login
export const loginOLDDDDDDD = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    // if (user.role === "player" && !user.isActive) {
    //   return res.status(403).json({
    //     message: "Your account is pending approval. Please wait for admin verification."
    //   });
    // }

    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    const maxAge = 7 * 24 * 60 * 60 * 1000;

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "none",
      maxAge,
    });

    const baseURL = `${req.protocol}://${req.get("host")}`;
    const userData = user.toObject();

    if (userData.profileImage) {
      if (!userData.profileImage.startsWith("http")) {
        userData.profileImage = `${baseURL}${userData.profileImage}`;
      }
    }

    res.json({ message: "Login successful", token, user: userData });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Only Super Admin can create Admin users
export const createCarOwner = async (req, res) => {
  try {
    const { fullName, email, password, phoneNumber, companyName, correspondedMe } = req.body;
    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: "User already exists" });

    const admin = await User.create({ fullName, email, password, phoneNumber, companyName, correspondedMe, role: "owner", isActive: true, status: "approved" });
    res.status(201).json({ message: "Owner created successfully", admin });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

// Logout
export const logoutOLLLDDDDD = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const user = req.user;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "No token provided",
      });
    }

    // Decode token to get expiry
    const decoded = jwt.decode(token);

    // Add token to blacklist
    await TokenBlacklist.create({
      token: token,
      userId: user._id,
      expiresAt: new Date(decoded.exp * 1000),
    });

    console.log(`User logged out: ${user.email} (${user.role})`);

    res.json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      success: false,
      message: "Server Error"
    });
  }
};

// Forgot Password
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user)
      return res.status(400).json({ success: false, message: "Email not found" });

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 1000 * 60 * 30; // 30 minutes

    await user.save();

    // Reset link
    const resetLink = `${process.env.RESET_PASSWORD_URL}/${resetToken}`;

    // Send Email
    const msg = {
      to: user.email,
      from: "info.cyberbells@gmail.com",
      subject: "Password Reset Request",
      html: `
        <h3>Password Reset</h3>
        <p>Click the link below to reset your password:</p>
        <a href="${resetLink}" target="_blank">${resetLink}</a>
        <p>This link will expire in 30 minutes.</p>
      `,
    };

    await sgMail.send(msg);

    return res.json({
      success: true,
      message: "Password reset link sent successfully",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};

// Reset Password
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() }, // not expired
    });

    if (!user)
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token",
      });

    user.password = password; // hashing will happen in model pre-save
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    return res.status(200).json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({ success: false, message: "Server error" });
  }
};


// Juco Coach and Media Registration
export const registerJucoCoachaMedia = async (req, res) => {
  try {
    const { email, role } = req.body;

    if (!email || !role) {
      return res.status(400).json({
        message: "Email and role are required"
      });
    }

    if (["superAdmin", "player"].includes(role)) {
      return res.status(403).json({
        message: `${role} cannot use this registration endpoint`
      });
    }

    if (role === "coach" || role === "scout") {
      return res.status(400).json({
        message: "`$role` must use the their registration endpoint"
      });
    }

    const existing = await User.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: "User already exists" });
    }

    const user = await User.create({
      email,
      role,
      registrationStatus: "pending"
    });

    return res.status(201).json({
      message: `User with role ${role} registered successfully`,
      user
    })
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};










export const uploadPublicUserVideos = async (req, res) => {
  try {
    const { userId } = req.body; 

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No videos uploaded"
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    const baseURL = `${req.protocol}://${req.get("host")}`;

    const uploadedVideos = req.files.map(file => ({
      url: `/${file.path.replace(/\\/g, "/")}`,
      title: file.originalname,
      uploadedAt: new Date(),
      fileSize: file.size
    }));

    user.videos.push(...uploadedVideos);
    await user.save();

    return res.status(200).json({
      success: true,
      message: "Videos uploaded successfully",
      videos: uploadedVideos
    });

  } catch (error) {
    console.error("Public upload videos error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error"
    });
  }
};