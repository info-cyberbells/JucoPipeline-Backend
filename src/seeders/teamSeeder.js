import mongoose from "mongoose";
import Team from "../models/team.model.js";
import dotenv from "dotenv";
import connectDB from "../config/db.js";
dotenv.config();

const teams = [
  {
    name: "SANTA FE COLLEGE",
    location: "Springfield, Illinois",
    logo: "https://d2o2figo6ddd0g.cloudfront.net/8/3/rgw0pag0xgt3g2/Primary_Logo_-_1x_2.png",
    division: "NJCAA Division I",
    region: "Region 4",
    rank: 5,
    coachName: "Michael Thompson",
    home: "7-4",
    away: "7-4",
    neutral: "0-0",
    conference: "8-3",
    isActive: true
  },
  {
    name: "Florida SouthWestern State College",
    location: "Lincoln, Nebraska",
    logo: "https://d2o2figo6ddd0g.cloudfront.net/s/m/oaghubf3mkmq/2019_logo.png",
    division: "NJCAA Division I",
    region: "Region 3",
    rank: 12,
    coachName: "Sarah Johnson",
    home: "10-2",
    away: "5-5",
    neutral: "2-1",
    conference: "9-2",
    isActive: true
  },
  {
    name: "RIVERSIDE COMMUNITY COLLEGE",
    location: "Riverside, California",
    logo: "https://example.com/logos/riverside.png",
    division: "NJCAA Division II",
    region: "Region 1",
    rank: 8,
    coachName: "David Martinez",
    home: "8-3",
    away: "6-4",
    neutral: "1-1",
    conference: "7-4",
    isActive: true
  },
  {
    name: "EASTERN FLORIDA STATE",
    location: "Melbourne, Florida",
    logo: "https://example.com/logos/easternflorida.png",
    division: "NJCAA Division I",
    region: "Region 8",
    rank: 3,
    coachName: "James Rodriguez",
    home: "12-1",
    away: "9-2",
    neutral: "3-0",
    conference: "10-1",
    isActive: true
  },
  {
    name: "UCLA",
    location: "Los Angeles, California",
    logo: "https://example.com/logos/ucla.png",
    division: "NCAA Division I",
    region: "West",
    rank: 2,
    coachName: "John Savage",
    home: "15-1",
    away: "11-3",
    neutral: "4-1",
    conference: "12-2",
    isActive: true
  },
  {
    name: "UNIVERSITY OF FLORIDA",
    location: "Gainesville, Florida",
    logo: "https://example.com/logos/florida.png",
    division: "NCAA Division I",
    region: "Southeast",
    rank: 1,
    coachName: "Kevin O'Sullivan",
    home: "18-0",
    away: "12-2",
    neutral: "5-0",
    conference: "14-1",
    isActive: true
  }
];

const seedTeams = async () => {
  try {
    // Connect to MongoDB
    await connectDB();
    console.log("MongoDB connected for team seeding");

    // Clear existing teams
    await Team.deleteMany({});
    console.log("Existing teams cleared");

    // Insert new teams
    const createdTeams = await Team.insertMany(teams);
    console.log(`${createdTeams.length} teams seeded successfully`);

    // Display created teams
    createdTeams.forEach(team => {
      console.log(`- ${team.name} (${team.location})`);
    });

    process.exit(0);
  } catch (error) {
    console.error("Error seeding teams:", error);
    process.exit(1);
  }
};

seedTeams();