# Co-Steer MVP

A conversational AI tool for CEOs to run their weekly steering loop.

The assistant helps you open each week with clarity: extract priorities, define ownership, surface risks, and generate a team brief — all through a natural conversation.

---

## What it does

- **Weekly Opener** — AI-guided conversation to set the week's priorities
- **Team Brief** — auto-generated brief ready to share with the team
- **Company Context** — paste or upload your company profile once, it persists across sessions
- **Voice Input** — speak instead of type (uses OpenAI Whisper)

---

## Requirements

- [Node.js](https://nodejs.org/) v18 or higher
- An OpenAI API key — get one at [platform.openai.com](https://platform.openai.com/api-keys)

---

## Setup

### 1. Clone the repo

```bash
git clone https://github.com/DanielDahandahandahan/co-steer-team.git
cd co-steer-team
```

> If you don't have git, download the ZIP from GitHub (green "Code" button → Download ZIP), unzip it, and open the folder in Terminal.

### 2. Add your OpenAI API key

In the root of the project, create a file called `.env`:

```
OPENAI_API_KEY=sk-...your-key-here...
```

You can copy `.env.example` and fill in your key.

### 3. Install dependencies

```bash
cd backend
npm install
cd ..
```

### 4. Start the server

```bash
cd backend
node server.js
```

You should see:

```
Co-Steer MVP Backend running on http://localhost:3000
```

### 5. Open the app

Open `index.html` in your browser. You can do this by:
- Double-clicking the file in Finder
- Or dragging it into a browser window

> The server must be running (step 4) for the AI chat to work.

---

## How to use

1. **Load company context** — In the *Data Sources* tab, paste a short description of your company (who you are, what you do, your team). This is used by the AI in every conversation.

2. **Start the weekly loop** — Click *Weekly Loop* in the *Workflows* tab, then click *Start Weekly Opener*. The AI will guide you through the week's priorities.

3. **Generate a team brief** — Once your priorities are confirmed, click *Generate Team Brief*. The brief appears in the *Objectives* tab.

4. **Voice input** — Click the mic icon next to the chat input. Speak, then click again to stop. The transcript is added to the input field — review it and hit Send.

---

## Troubleshooting

**"I don't have a company profile loaded"** — Go to *Data Sources* and paste your company context first.

**Chat returns no response / error** — Make sure the backend server is running (`node server.js` in the `backend/` folder).

**Voice doesn't work** — Check that your browser has microphone access (browser → site settings → microphone). Also confirm `OPENAI_API_KEY` is set correctly in `.env`.

**API quota error** — The app will fall back to a mock response if the OpenAI API key is missing or over quota. The mock shows example data so you can explore the UI without a key.

---

## Project background

Co-Steer was developed as part of a collaborative project exploring AI tools for executive teams. This MVP validates the core weekly steering loop: context → conversation → brief.
