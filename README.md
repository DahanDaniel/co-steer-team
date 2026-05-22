# Co-Steer — Weekly Loop AI Copilot

Co-Steer is a CEO dashboard that runs a structured weekly steering conversation with an AI Chief of Staff. You upload your company context, have a focused conversation about this week's priorities, approve a task list (with owners and deadlines), and get a team brief generated automatically. The whole flow is driven by a single HTML file talking to a small Node/Express backend.

This repo gives you the working reference implementation. The backend uses OpenAI directly. If you want to plug in your own agents — you can. The section "Replacing the backend" below explains exactly what the frontend expects from the API.

---

## Quick start

1. **Clone the repo**

   ```bash
   git clone https://github.com/DahanDaniel/co-steer-team.git
   cd co-steer-team
   ```

   No git? Download the ZIP from GitHub (green "Code" button → Download ZIP), unzip, and open the folder in Terminal.

2. **Create your `.env` file** inside the `backend/` folder

   ```
   OPENAI_API_KEY=sk-...your-key-here...
   ```

3. **Install dependencies**

   ```bash
   cd backend
   npm install
   ```

4. **Start the server**

   ```bash
   node server.js
   ```

   You should see: `Co-Steer MVP Backend running on http://localhost:3000`

5. **Open the app**

   Go to [http://localhost:3000](http://localhost:3000) in your browser. The server serves the UI from the `frontend/` folder — no need to open any HTML file directly.

---

## How it works

The entire frontend lives in `index.html` — no build step, no framework. It makes plain HTTP calls to the backend.

The backend (`backend/server.js`) is a Node.js + Express server that:
- Serves the static `index.html` at the root
- Stores state (company profile, generated briefs) in `backend/data/db.json` — auto-created on first run
- Forwards chat messages to the OpenAI chat API
- Transcribes audio via the Whisper API (`/api/transcribe`)

The flow:

```
User → index.html → POST /api/chat → OpenAI → { reply, readyForApproval } → UI
```

When the conversation reaches a natural completion point, the backend returns `readyForApproval: true`, which triggers the "Generate Team Brief" button in the UI.

---

## Replacing the backend with your own agents

This is the core handoff. If you want Co-Steer to call your own agents (bookkeeping, content, whatever), you don't need to touch `index.html`. You just need to serve the same API contract below.

The frontend lives in `frontend/` and uses relative API paths (`/api/...`), so it always talks to whatever server is hosting it. The backend serves `frontend/` as static files. If you run your own backend on a different port, just serve the `frontend/` directory as static content and all API calls will route correctly.

### Endpoints

**`GET /api/context`**

Returns the stored company profile.

```json
{ "profile": "string or null" }
```

If no profile has been uploaded yet, return `{ "profile": null }`.

---

**`POST /api/context/upload`**

Receives a multipart form upload with a field named `file` (a `.md` file). Store the content as the company profile for use in chat.

No specific response shape required — the UI just checks for a non-error status.

---

**`POST /api/chat`**

This is the main endpoint. Body:

```json
{
  "message": "string",
  "history": [
    { "role": "user", "content": "..." },
    { "role": "assistant", "content": "..." }
  ]
}
```

The frontend sends the full conversation history on every call. Your backend receives this and can route it to whatever agent handles weekly planning.

Required response shape:

```json
{
  "reply": "string",
  "readyForApproval": false
}
```

Two behaviors to preserve:

- If no company profile is loaded when a message arrives, return `{ "requiresContext": true }`. The UI will interrupt the conversation and prompt the user to upload their company context.
- When the conversation has reached a point where priorities are confirmed and it makes sense to generate a brief, return `"readyForApproval": true`. This surfaces the "Generate Team Brief" / "Make Adjustments" buttons in the UI.

---

**`POST /api/briefs/generate`**

Body: `{ "history": [...] }` — the full conversation history.

Generate a team brief from the conversation and store it. Return the brief content in whatever shape you prefer — the UI will display whatever comes back.

---

**`GET /api/briefs/team`**

Returns an array of previously generated briefs. These appear in the Objectives view.

```json
[
  { "id": "...", "content": "...", "createdAt": "..." }
]
```

---

**`POST /api/reset`**

Resets all state (company profile, briefs, conversation) to a clean slate. Useful during testing. No specific response shape required.

---

**`POST /api/transcribe`**

Receives a multipart form upload with a field named `audio`. Transcribes the audio and returns:

```json
{ "text": "transcribed text here" }
```

This is optional — voice input only works if this endpoint is live. If you skip it, the mic button in the UI will fail silently.

---

## Sample company context

A file called `sample_company_context.md` is included in the repo. It shows the format the AI expects: company description, team structure, current priorities, and any context that helps the Chief of Staff give relevant responses. Use it as a starting point or replace it entirely.

---

## Notes

- Voice input requires a valid `OPENAI_API_KEY` in your `.env` — it calls Whisper directly. If the key is missing or invalid, the rest of the app still works, just without voice.
- `POST /api/reset` clears everything including the company profile. Useful for testing a clean run, but don't hit it in production by accident.
- The `db.json` file is auto-created in `backend/data/` on first run. If you want a fresh start manually, just delete it.

---

## Support

If you run into anything while building your own backend — questions about the API contract, something behaving unexpectedly in the UI, or you want to talk through how to wire in your existing agents — reach out to Daniel. Happy to help during implementation.
