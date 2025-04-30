/**
 * Database configuration for MongoDB connection
 * This file manages all database connection logic
 */
const mongoose = require("mongoose");

// Function to connect to the database
const connectDatabase = async () => {
  try {
    // Get connection string from environment variables
    const DB = process.env.DATABASE.replace(
      "<db_password>",
      process.env.DATABASE_PASSWORD
    );

    console.log("Connecting to database...");

    // Connect to MongoDB
    const connection = await mongoose.connect(DB);

    console.log("DB connected successfully!");
    console.log(`Cluster name: ${connection.connection.host}`);

    // Handle rollNo index in Student model if needed
    if (
      mongoose.models.Student &&
      mongoose.models.Student.dropSingleRollNoIndex
    ) {
      try {
        await mongoose.models.Student.dropSingleRollNoIndex();
      } catch (error) {
        console.error("Error dropping rollNo index:", error);
      }
    }

    return connection;
  } catch (error) {
    console.error("Database connection error:", error);
    throw error;
  }
};

module.exports = connectDatabase;
