import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import cookieParser from "cookie-parser";
import session from "express-session";

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(cookieParser());
app.use(session({
  secret: "launchpad-secret-key",
  resave: false,
  saveUninitialized: true,
  cookie: { 
    secure: true, 
    sameSite: 'none',
    httpOnly: true 
  }
}));

// Mock Database for Agents
let deployedAgents: any[] = [];

// API Routes
app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

// OAuth URL Generator (Mock for now, but following the pattern)
app.get("/api/auth/url", (req, res) => {
  const { provider } = req.query;
  const appUrl = process.env.APP_URL || `http://localhost:${PORT}`;
  const redirectUri = `${appUrl}/auth/callback`;
  
  let providerUrl = "";
  let scope = "";
  
  switch(provider) {
    case 'google':
      providerUrl = "https://accounts.google.com/o/oauth2/v2/auth";
      scope = "https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/drive.file";
      break;
    case 'x':
      providerUrl = "https://twitter.com/i/oauth2/authorize";
      scope = "tweet.read tweet.write users.read";
      break;
    case 'linkedin':
      providerUrl = "https://www.linkedin.com/oauth/v2/authorization";
      scope = "r_liteprofile w_member_social";
      break;
    default:
      return res.status(400).json({ error: "Unsupported provider" });
  }

  const params = new URLSearchParams({
    client_id: process.env[`${String(provider).toUpperCase()}_CLIENT_ID`] || "MOCK_CLIENT_ID",
    redirect_uri: redirectUri,
    response_type: "code",
    scope: scope,
    state: String(provider)
  });

  res.json({ url: `${providerUrl}?${params.toString()}` });
});

// OAuth Callback
app.get("/auth/callback", (req, res) => {
  const { code, state } = req.query;
  // In a real app, exchange code for tokens here
  
  res.send(`
    <html>
      <body>
        <script>
          if (window.opener) {
            window.opener.postMessage({ 
              type: 'OAUTH_AUTH_SUCCESS', 
              provider: '${state}' 
            }, '*');
            window.close();
          } else {
            window.location.href = '/';
          }
        </script>
        <p>Authentication successful for ${state}. This window should close automatically.</p>
      </body>
    </html>
  `);
});

// Agent Deployment
app.post("/api/agents/deploy", (req, res) => {
  const { agentId, task, productName } = req.body;
  const newAgent = {
    id: Math.random().toString(36).substr(2, 9),
    agentId,
    task,
    productName,
    status: "deploying",
    logs: [`Initializing ${agentId} for ${productName}...`],
    createdAt: new Date().toISOString()
  };
  
  deployedAgents.push(newAgent);
  
  // Simulate autonomous execution
  setTimeout(() => {
    const agent = deployedAgents.find(a => a.id === newAgent.id);
    if (agent) {
      agent.status = "executing";
      agent.logs.push(`Connecting to social channels...`);
      agent.logs.push(`Drafting content for ${productName}...`);
    }
  }, 2000);

  setTimeout(() => {
    const agent = deployedAgents.find(a => a.id === newAgent.id);
    if (agent) {
      agent.status = "completed";
      agent.logs.push(`Task completed successfully.`);
    }
  }, 10000);

  res.json(newAgent);
});

app.get("/api/agents", (req, res) => {
  res.json(deployedAgents);
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
