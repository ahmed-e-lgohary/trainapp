const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const mongoURI = process.env.MONGO_URI;
if (!mongoURI) {
  console.error("MONGO_URI not found in .env file!");
  process.exit(1);
}

async function backup() {
  try {
    console.log("Connecting to database...");
    await mongoose.connect(mongoURI);
    console.log("Connected successfully!");

    const db = mongoose.connection.db;
    const collections = await db.listCollections().toArray();

    const backupDir = path.join(__dirname, 'db-backup-' + new Date().toISOString().replace(/[:.]/g, '-'));
    if (!fs.existsSync(backupDir)) {
      fs.mkdirSync(backupDir);
    }

    console.log(`Created backup directory: ${backupDir}`);

    for (let col of collections) {
      const colName = col.name;
      console.log(`Backing up collection: ${colName}...`);
      const documents = await db.collection(colName).find({}).toArray();
      const filePath = path.join(backupDir, `${colName}.json`);
      fs.writeFileSync(filePath, JSON.stringify(documents, null, 2), 'utf8');
      console.log(`Saved ${documents.length} documents from ${colName} to ${filePath}`);
    }

    console.log("Backup completed successfully!");
  } catch (error) {
    console.error("Backup failed:", error);
  } finally {
    await mongoose.disconnect();
  }
}

backup();
