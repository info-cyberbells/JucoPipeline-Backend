import mongoose from "mongoose";
import dotenv from "dotenv";
import RouteType from "../models/routeType.model.js";
import VehicleType from "../models/vehicleType.model.js";
import DriverSkill from "../models/driverSkill.model.js";
import connectDB from "../config/db.js";

dotenv.config();

// ====== DATA ======
const routeTypes = [
  { name: "City", description: "Within city limits — traffic, signals, short distances" },
  { name: "Intercity", description: "Long distance between cities, smooth road, high speed" },
  { name: "Rural", description: "Small villages, rough roads, narrow paths" },
  { name: "Intra-zone", description: "Specific area or zone delivery (e.g., local courier or pickup)" },
  { name: "Mountain", description: "Uphill, downhill, sharp turns" },
  { name: "Coastal", description: "Near sea ports, heavy truck movement" },
  { name: "Industrial", description: "Heavy vehicles, equipment area" },
  { name: "Tour", description: "Tourist locations, sightseeing, long drives" },
  { name: "Airport", description: "Specific to airport deliveries, timing-sensitive" },
  { name: "Overnight Trips", description: "Routes done during night shifts" }
];

const vehicleTypes = [
  { name: "Car (LMV)", example: "Taxi, cab, personal car" },
  { name: "Bike", example: "Delivery, courier, food apps" },
  { name: "Auto Rickshaw", example: "Local transport" },
  { name: "Pickup Van", example: "Goods delivery (local transport)" },
  { name: "Heavy Vehicle (HMV)", example: "Long route transport" },
  { name: "Passenger Vehicle", example: "School, travel, city buses" },
  { name: "Farm Vehicle", example: "Agricultural work" },
  { name: "Mini Bus", example: "Tourist or staff transport" },
  { name: "Container Truck", example: "Industrial or port logistics" },
  { name: "Electric Vehicle (EV)", example: "Cars, bikes, autos (modern category)" }
];

const driverSkills = [
  { name: "City Driving", description: "Knows traffic rules, handling congestion" },
  { name: "Highway Driving", description: "Long-distance, lane discipline, night drives" },
  { name: "Hill Driving", description: "Handles slopes, brakes, clutch balance" },
  { name: "Night Driving", description: "Confident and alert at night" },
  { name: "Off-road Driving", description: "Muddy, uneven, or rocky areas" },
  { name: "Heavy Vehicle Handling", description: "Trucks, buses" },
  { name: "Light Vehicle Handling", description: "Cars, vans" },
  { name: "Passenger Handling", description: "Polite behavior, smooth driving" },
  { name: "Logistics Handling", description: "Loading, unloading knowledge" },
  { name: "Defensive Driving", description: "Safety-focused driving, accident prevention" },
  { name: "GPS Knowledge", description: "Knows how to use maps" },
  { name: "Emergency Handling", description: "Quick reaction to accidents, breakdowns" },
  { name: "Vehicle Maintenance", description: "Basic repair, tire change, oil check" },
  { name: "Fuel Efficiency Driving", description: "Economical driving techniques" },
  { name: "Hybrid Vehicle Operation", description: "Understanding of electric vehicles" }
];

// ====== SEED FUNCTION ======
const seedMasters = async () => {
  try {
    await connectDB();
    console.log("Database connected ✅");

    // await RouteType.deleteMany();
    // await VehicleType.deleteMany();
    // await DriverSkill.deleteMany();

    const insertedRoutes = await RouteType.insertMany(routeTypes);
    const insertedVehicles = await VehicleType.insertMany(vehicleTypes);
    const insertedSkills = await DriverSkill.insertMany(driverSkills);

    // console.log("Inserted route types:", insertedRoutes.length);
    // console.log("Inserted vehicle types:", insertedVehicles.length);
    // console.log("Inserted skills:", insertedSkills.length);

    console.log("Master data seeded successfully!");
    await mongoose.disconnect();
    console.log("Database disconnected");
    process.exit(0);
  } catch (err) {
    console.error("Seeder failed:", err);
    process.exit(1);
  }
};

seedMasters();
