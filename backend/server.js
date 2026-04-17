// 1. CRITICAL DNS FIX
const dns = require('node:dns');
dns.setDefaultResultOrder('ipv4first');

require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const pdf = require('pdf-parse'); // We will fix this with the commands above
const fs = require('fs');
const path = require('path');

// No OpenAI import needed for Offline Mode

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Ensure 'uploads' directory exists
const uploadDir = './uploads';
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir);
}

// Database Connection
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// Define Schema
const documentSchema = new mongoose.Schema({
  filename: String,
  extractedData: Object,
  status: { type: String, default: 'Pending' },
  createdAt: { type: Date, default: Date.now }
});
const Document = mongoose.model('Document', documentSchema);

// Multer Setup
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + file.originalname)
});
const upload = multer({ storage: storage });

// Helper to read PDF
async function extractTextFromFile(filePath) {
    const dataBuffer = fs.readFileSync(filePath);
    if (filePath.endsWith('.pdf')) {
        try {
            const data = await pdf(dataBuffer);
            return data.text;
        } catch (error) {
            console.error("Error parsing PDF:", error);
            return "Could not parse PDF text.";
        }
    }
    return dataBuffer.toString();
}

// --- ROUTES ---

// 1. Upload & Extract (OFFLINE MODE - No OpenAI Needed)
app.post('/api/upload', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

        console.log("Processing file:", req.file.originalname);

        const filePath = req.file.path;
        const textContent = await extractTextFromFile(filePath);
        
        // Clean up file
        fs.unlinkSync(filePath);

        // --- MOCK AI RESPONSE (To save data to MongoDB) ---
        // We use fake data because your OpenAI key has no quota.
        const extractedData = {
            documentType: "Uploaded Document",
            date: new Date().toISOString().split('T')[0],
            partiesInvolved: ["System User"],
            summary: "This is offline mode. OpenAI was skipped due to quota limits.",
            amount: "$0.00",
            textPreview: textContent.substring(0, 100) // Save a snippet of text
        };

        // Save to DB
        const newDoc = new Document({
            filename: req.file.originalname,
            extractedData,
            status: 'Extracted'
        });
        await newDoc.save();
        console.log("✅ Saved to MongoDB");

        res.json(newDoc);
    } catch (error) {
        console.error("Upload Error:", error);
        res.status(500).json({ error: 'Upload failed' });
    }
});

// 2. Get All Documents
app.get('/api/documents', async (req, res) => {
    try {
        const docs = await Document.find().sort({ createdAt: -1 });
        res.json(docs);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch documents' });
    }
});

// 3. Trigger n8n Webhook
app.post('/api/send/:id', async (req, res) => {
    try {
        const doc = await Document.findById(req.params.id);
        if (!doc) return res.status(404).json({ error: 'Document not found' });

        console.log("Trying to send to n8n...");
        
        // This will fail if n8n isn't running, that's okay.
        try {
            await fetch(process.env.N8N_WEBHOOK_URL, {
                method: 'POST',
                body: JSON.stringify(doc),
                headers: { 'Content-Type': 'application/json' }
            });
            doc.status = 'Sent';
        } catch (n8nError) {
            console.log("n8n is offline, but document status updated.");
            doc.status = 'Sent (n8n offline)'; // Allow user to finish flow even without n8n
        }
        
        await doc.save();
        res.json({ message: 'Status updated!' });
    } catch (error) {
        console.error("Send Error:", error);
        res.status(500).json({ error: 'Failed to update status' });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));