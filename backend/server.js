const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');
const multer = require('multer');

dotenv.config({ path: path.join(__dirname, '../.env') });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Setup simple DB
const DB_FILE = path.join(__dirname, 'data', 'db.json');

const initDB = () => {
    if (!fs.existsSync(path.dirname(DB_FILE))) {
        fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
        const defaultDb = {
            companyProfile: null,
            workingMemory: {
                currentWeekPlan: [],
                pendingTasks: []
            },
            artifacts: {
                leaderBriefs: [],
                teamBriefs: []
            },
            activityLog: []
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2));
    }
};

const readDB = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

initDB();

// Serve frontend from repo root
app.use(express.static(path.join(__dirname, '..')));

// Setup Multer for file uploads
const upload = multer({ dest: 'uploads/' });

// API: Upload Company Context (Bypass Onboarding)
app.post('/api/context/upload', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const fileContent = fs.readFileSync(req.file.path, 'utf-8');
        const db = readDB();
        db.companyProfile = fileContent;
        writeDB(db);
        
        // Clean up uploaded file
        fs.unlinkSync(req.file.path);
        
        res.json({ message: 'Company context uploaded successfully', profile: db.companyProfile });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Get Company Context
app.get('/api/context', (req, res) => {
    const db = readDB();
    res.json({ profile: db.companyProfile });
});

// API: Reset app state (for testing / fresh start)
app.post('/api/reset', (req, res) => {
    const defaultDb = {
        companyProfile: null,
        workingMemory: { currentWeekPlan: [], pendingTasks: [] },
        artifacts: { leaderBriefs: [], teamBriefs: [] },
        activityLog: []
    };
    writeDB(defaultDb);
    res.json({ message: 'App state reset successfully' });
});

// API: Fetch Team Briefs
app.get('/api/briefs/team', (req, res) => {
    const db = readDB();
    res.json(db.artifacts.teamBriefs);
});

// API: Generate Brief
app.post('/api/briefs/generate', (req, res) => {
    const { history } = req.body;
    const db = readDB();
    const newBrief = {
        id: Date.now(),
        date: new Date().toISOString(),
        content: "Generated Team Brief based on latest approval. AI Context summary: " + (history[history.length-1]?.content || "No details"),
        status: 'Published'
    };
    db.artifacts.teamBriefs.push(newBrief);
    writeDB(db);
    res.json({ message: "Brief generated successfully.", brief: newBrief });
});

// Mock OpenAI or real
let openai;
if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// System Prompts placeholders
const loadPrompt = (filename) => {
    const promptPath = path.join(__dirname, 'prompts', filename);
    if (fs.existsSync(promptPath)) {
        return fs.readFileSync(promptPath, 'utf-8');
    }
    return '';
};

// API: Chat (Weekly Loop)
app.post('/api/chat', async (req, res) => {
    const { message, history } = req.body;
    const db = readDB();
    
    // Check if Company Profile exists
    if (!db.companyProfile) {
        return res.json({ 
            reply: "I don't have a company profile loaded. Before we begin the weekly loop, please provide your company context.", 
            readyForApproval: false,
            requiresContext: true
        });
    }

    const systemPrompt = loadPrompt('UC-1_Weekly_Opener.md') || "You are the SayItOnce Copilot Assistant.";
    
    // Inject instructions for structured JSON output
    const jsonInstructions = `\n\nCRITICAL INSTRUCTION: You must respond in pure JSON matching this schema exactly: {"reply": "Your conversational response", "readyForApproval": boolean}
- readyForApproval must be false during the conversation.
- Set readyForApproval to true ONLY when BOTH conditions are met: (1) you have shown a complete numbered priority list with owners and definitions of done, AND (2) the CEO has explicitly confirmed it — with words like "ok", "approved", "looks good", "yes", "zatwierdź", "tak", "wygląda dobrze", or equivalent.
- Do NOT set readyForApproval to true based on your own judgment — wait for explicit CEO confirmation.`;

    const messages = [
        { role: 'system', content: `Company Profile Context:\n${db.companyProfile}\n\n${systemPrompt}${jsonInstructions}` },
        ...(history || []),
        { role: 'user', content: message }
    ];

    // Helper for mock response
    const getMockResponse = (msg) => {
        let reply = "I am a mocked response because the real AI is currently unavailable or out of quota.";
        let readyForApproval = false;
        
        if (msg.toLowerCase().includes('open this week') || msg.toLowerCase().includes('generate my monday brief')) {
             reply = "Here is your Weekly Plan preview:\n\n1. Review Q2 OKRs - owner: CEO\n2. Sync with CMO on new campaign - owner: CEO\n3. Finalize Q3 hiring plan - owner: HR\n\nDoes this look correct?";
             readyForApproval = true;
        }
        return { reply, readyForApproval };
    };

    try {
        if (openai) {
            try {
                const completion = await openai.chat.completions.create({
                    model: "gpt-4o",
                    messages: messages,
                    response_format: { type: "json_object" }
                });
                const rawReply = completion.choices[0].message.content;
                const parsed = JSON.parse(rawReply);
                
                return res.json({ reply: parsed.reply, readyForApproval: parsed.readyForApproval });
            } catch (apiError) {
                console.error("OpenAI API Error, falling back to mock:", apiError.message);
                return res.json(getMockResponse(message));
            }
        } else {
            return res.json(getMockResponse(message));
        }
    } catch (error) {
        console.error("Critical error in chat route:", error);
        res.status(500).json({ error: 'Failed to communicate with LLM or parse JSON' });
    }
});

// ─── Voice Transcription (Whisper) ───────────────────────────────────────────

app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
    if (!openai) {
        return res.status(503).json({ error: 'OPENAI_API_KEY not configured' });
    }
    if (!req.file) {
        return res.status(400).json({ error: 'Missing audio file' });
    }
    const filePath = req.file.path;
    try {
        const transcription = await openai.audio.transcriptions.create({
            file: fs.createReadStream(filePath),
            model: 'whisper-1'
        });
        res.json({ text: transcription.text || '' });
    } catch (err) {
        console.error('Whisper transcription failed:', err.message);
        res.status(500).json({ error: 'Transcription failed', detail: err.message });
    } finally {
        try { fs.unlinkSync(filePath); } catch (_) {}
    }
});

app.listen(PORT, () => {
    console.log(`Co-Steer MVP Backend running on http://localhost:${PORT}`);
});
