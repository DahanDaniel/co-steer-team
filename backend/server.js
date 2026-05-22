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
app.use(express.static(path.join(__dirname, '../frontend')));

const PORT = process.env.PORT || 3000;

const DB_FILE = path.join(__dirname, 'data', 'db.json');

const initDB = () => {
    if (!fs.existsSync(path.dirname(DB_FILE))) {
        fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
        fs.writeFileSync(DB_FILE, JSON.stringify({
            companyProfile: null,
            workingMemory: { currentWeekPlan: [], pendingTasks: [] },
            artifacts: { leaderBriefs: [], teamBriefs: [] },
            activityLog: []
        }, null, 2));
    }
};

const readDB = () => JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
const writeDB = (data) => fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));

initDB();

const upload = multer({ dest: 'uploads/' });

let openai;
if (process.env.OPENAI_API_KEY) {
    openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

// API: Upload Company Context
app.post('/api/context/upload', upload.array('files'), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        let fileContent = '';
        for (const file of req.files) {
            fileContent += fs.readFileSync(file.path, 'utf-8') + '\n\n';
            fs.unlinkSync(file.path);
        }

        const db = readDB();
        db.companyProfile = fileContent;

        if (openai) {
            try {
                const completion = await openai.chat.completions.create({
                    model: 'gpt-4o',
                    messages: [
                        { role: 'system', content: 'You are an expert context extractor and summarizer.' },
                        { role: 'user', content: `Extract and summarize the core company context. Focus ONLY on: company description and objectives, leadership team, team members and roles. Format in markdown.\n\n${fileContent}` }
                    ]
                });
                db.companySummary = completion.choices[0].message.content;
            } catch (e) {
                db.companySummary = fileContent;
            }
        } else {
            db.companySummary = fileContent;
        }

        writeDB(db);
        res.json({ message: 'Company context uploaded successfully', profile: db.companySummary });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// API: Get Company Context
app.get('/api/context', (req, res) => {
    const db = readDB();
    res.json({ profile: db.companySummary || db.companyProfile });
});

// API: Clear Company Context
app.delete('/api/context', (req, res) => {
    const db = readDB();
    db.companyProfile = null;
    db.companySummary = null;
    writeDB(db);
    res.json({ message: 'Company context cleared' });
});

// API: Reset all state
app.post('/api/reset', (req, res) => {
    writeDB({
        companyProfile: null,
        workingMemory: { currentWeekPlan: [], pendingTasks: [] },
        artifacts: { leaderBriefs: [], teamBriefs: [] },
        activityLog: []
    });
    res.json({ message: 'App state reset successfully' });
});

// API: Fetch Team Briefs
app.get('/api/briefs/team', (req, res) => {
    const db = readDB();
    res.json(db.artifacts.teamBriefs);
});

// API: Clear All Team Briefs
app.delete('/api/briefs/team', (req, res) => {
    const db = readDB();
    db.artifacts.teamBriefs = [];
    writeDB(db);
    res.json({ message: 'All team briefs cleared' });
});

// API: Delete Specific Team Brief
app.delete('/api/briefs/team/:id', (req, res) => {
    const db = readDB();
    const id = parseInt(req.params.id, 10);
    db.artifacts.teamBriefs = db.artifacts.teamBriefs.filter(b => b.id !== id);
    writeDB(db);
    res.json({ message: 'Brief deleted successfully' });
});

// API: Update Specific Team Brief
app.put('/api/briefs/team/:id', (req, res) => {
    const db = readDB();
    const id = parseInt(req.params.id, 10);
    const index = db.artifacts.teamBriefs.findIndex(b => b.id === id);
    if (index === -1) return res.status(404).json({ error: 'Brief not found' });
    db.artifacts.teamBriefs[index].content = req.body.content;
    writeDB(db);
    res.json({ message: 'Brief updated successfully', brief: db.artifacts.teamBriefs[index] });
});

// API: Generate Brief
app.post('/api/briefs/generate', async (req, res) => {
    const { history } = req.body;
    const db = readDB();

    const timestamp = new Date();
    const dateStr = timestamp.toLocaleDateString('en-GB');
    const timeStr = timestamp.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

    let generatedBriefs = [];

    try {
        if (!openai) throw new Error('OpenAI not configured');

        const systemPrompt = `You are a strict JSON generator. Based on the following Weekly Loop chat, generate team weekly briefs.

Output a valid JSON array. Each object must have:
- "role": job title (e.g. "CEO", "Head of Sales")
- "name": person's name or role if unknown
- "focus": short 1-sentence weekly focus
- "priorities": array of objects with "task", "dod" (Definition of Done), "deadline"
- "communication": any cross-departmental communication needed

Output ONLY the JSON array, no other text.`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            messages: [
                { role: 'system', content: `Company Profile:\n${db.companyProfile}\n\n${systemPrompt}` },
                ...history
            ],
            temperature: 0.2
        });

        let jsonRaw = completion.choices[0].message.content;
        if (jsonRaw.startsWith('```')) {
            jsonRaw = jsonRaw.replace(/^```json\n/, '').replace(/\n```$/, '');
        }

        const parsed = JSON.parse(jsonRaw);
        if (Array.isArray(parsed)) generatedBriefs = parsed;
        else throw new Error('LLM did not return an array');
    } catch (err) {
        console.log('Brief generation fallback:', err.message);
        generatedBriefs = [{
            role: 'CEO',
            name: '',
            focus: 'Lead the team through this week\'s priorities.',
            priorities: [{ task: 'Review and communicate weekly priorities', dod: 'Team informed and aligned', deadline: 'Monday EOD' }],
            communication: 'Ensure all team leads are aware of their tasks.'
        }];
    }

    const newBriefs = generatedBriefs.map((b, i) => {
        let mdContent = `### Weekly Focus\n${b.focus}\n\n### Priorities\n`;
        if (b.priorities && Array.isArray(b.priorities)) {
            b.priorities.forEach((p, idx) => {
                mdContent += `${idx + 1}. **${p.task}**\n   - *DoD:* ${p.dod}\n   - *Deadline:* ${p.deadline}\n`;
            });
        }
        mdContent += `\n### Key Communication\n${b.communication}`;

        return {
            id: Date.now() + i,
            date: dateStr,
            time: timeStr,
            role: b.role,
            name: b.name,
            content: mdContent,
            rawJson: b,
            status: 'Published'
        };
    });

    db.artifacts.teamBriefs = [...db.artifacts.teamBriefs, ...newBriefs];
    writeDB(db);
    res.json({ message: 'Briefs generated successfully.', briefs: newBriefs });
});

// API: Voice Transcription
app.post('/api/transcribe', upload.single('audio'), async (req, res) => {
    if (!openai) return res.status(503).json({ error: 'OPENAI_API_KEY not configured' });
    if (!req.file) return res.status(400).json({ error: 'Missing audio file' });
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

const loadPrompt = (filename) => {
    const promptPath = path.join(__dirname, 'prompts', filename);
    if (fs.existsSync(promptPath)) return fs.readFileSync(promptPath, 'utf-8');
    return '';
};

// API: Chat (Weekly Loop)
app.post('/api/chat', async (req, res) => {
    const { message, history } = req.body;
    const db = readDB();

    if (!db.companyProfile) {
        return res.json({
            reply: "I don't have a company profile loaded. Before we begin the weekly loop, please provide your company context.",
            readyForApproval: false,
            requiresContext: true
        });
    }

    if (!openai) {
        return res.status(500).json({ error: 'OPENAI_API_KEY is not set in backend/.env' });
    }

    const systemPrompt = loadPrompt('UC-1_Weekly_Opener.md') || 'You are the Co-Steer Copilot Assistant.';

    const jsonInstructions = `\n\nCRITICAL INSTRUCTION: You must respond in pure JSON matching this schema exactly: {"reply": "Your conversational response", "readyForApproval": boolean}
- readyForApproval must be false during the conversation.
- Set readyForApproval to true ONLY when BOTH conditions are met: (1) you have shown a complete numbered priority list with owners and definitions of done, AND (2) the CEO has explicitly confirmed it — with words like "ok", "approved", "looks good", "yes", "zatwierdź", "tak", "wygląda dobrze", or equivalent.
- Do NOT set readyForApproval to true based on your own judgment — wait for explicit CEO confirmation.`;

    const messages = [
        { role: 'system', content: `Company Profile Context:\n${db.companyProfile}\n\n${systemPrompt}${jsonInstructions}` },
        ...(history || []),
        { role: 'user', content: message }
    ];

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages,
            response_format: { type: 'json_object' }
        });
        const parsed = JSON.parse(completion.choices[0].message.content);
        return res.json({ reply: parsed.reply, readyForApproval: parsed.readyForApproval });
    } catch (error) {
        console.error('OpenAI API Error:', error.message);
        res.status(500).json({ error: error.message || 'Failed to communicate with LLM' });
    }
});

app.listen(PORT, () => {
    console.log(`Co-Steer MVP Backend running on http://localhost:${PORT}`);
});
