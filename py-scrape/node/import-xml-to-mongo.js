const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');
const xml2js = require('xml2js');
require('dotenv').config();
 
// === CONFIG ===
const baseXmlFolder = path.join(__dirname, '..', 'Groczi', 'py-scrape', 'scrapes', 'files', 'xmlFiles');
const MONGO_URI = process.env.MONGO_URI;
const DB_NAME = process.env.DB_NAME;

const mongoClient = new MongoClient(MONGO_URI);
const parser = new xml2js.Parser({ explicitArray: false });

async function processXmlFiles() {
    try {
        await mongoClient.connect();
        const db = mongoClient.db(DB_NAME);

        const userFolders = fs.readdirSync(baseXmlFolder);

        for (const user of userFolders) {
            const userPath = path.join(baseXmlFolder, user);
            if (!fs.statSync(userPath).isDirectory()) continue;

            const files = fs.readdirSync(userPath).filter(file => file.endsWith('.xml'));
            const collection = db.collection(user); // ✅ Use username as collection name

            for (const file of files) {
                const filePath = path.join(userPath, file);
                const xmlContent = fs.readFileSync(filePath, 'utf-8');

                try {
                    const result = await parser.parseStringPromise(xmlContent);
                    const root = result.Root;
                    const chainId = root.ChainId;
                    const storeId = root.StoreId;

                    let items = root.Items?.Item || [];
                    if (!Array.isArray(items)) items = [items];

                    const products = items.map(item => ({
                        username: user,
                        filename: file,
                        chainId,
                        storeId,
                        itemCode: item.ItemCode,
                        itemName: item.ItemName,
                        itemPrice: parseFloat(item.ItemPrice),
                        manufacturer: item.ManufacturerName,
                        quantity: parseFloat(item.Quantity),
                        unit: item.UnitOfMeasure,
                        allowDiscount: item.AllowDiscount === '1',
                        itemStatus: item.ItemStatus,
                        updatedAt: item.PriceUpdateDate,
                        importedAt: new Date(),
                    }));

                    if (products.length > 0) {
                        await collection.insertMany(products);
                        console.log(`✅ Inserted ${products.length} items into [${user}] from ${file}`);
                    } else {
                        console.log(`⚠️ No items found in ${user}/${file}`);
                    }
                } catch (err) {
                    console.error(`❌ Error parsing/inserting ${file}: ${err.message}`);
                }
            }
        }
    } catch (err) {
        console.error("❌ MongoDB error:", err.message);
    } finally {
        await mongoClient.close();
        console.log("🚪 MongoDB connection closed.");
    }
}

processXmlFiles();
