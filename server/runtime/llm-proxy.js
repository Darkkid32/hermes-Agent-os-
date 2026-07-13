import https from "node:https";

const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

const MODEL_MAP = {
  claude: "minimaxai/minimax-m3",
  gemini: "minimaxai/minimax-m3",
  codex: "minimaxai/minimax-m3",
  openclaw: "minimaxai/minimax-m3",
  opencode: "minimaxai/minimax-m3",
  "free-claude-code": "minimaxai/minimax-m3"
};

// Per-model limits to prevent server crashes and token over-runs.
const MODEL_LIMITS = {
  "minimaxai/minimax-m3": { maxTokens: 4096, temperatureMax: 2.0 }
};

const MAX_MESSAGES = 50;
const MAX_MESSAGE_LENGTH = 16000;

function getApiKey() {
  const key = process.env.NVIDIA_API_KEY;
  if (!key || key.trim().length === 0) {
    throw new Error("NVIDIA_API_KEY is not configured");
  }
  return key;
}

function httpsPost(url, body, headers, timeoutMs = 120000) {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    const postData = JSON.stringify(body);
    let settled = false;

    const req = https.request({
      hostname: urlObj.hostname,
      port: 443,
      path: urlObj.pathname,
      method: "POST",
      headers: {
        ...headers,
        "Content-Length": Buffer.byteLength(postData)
      },
      timeout: timeoutMs
    }, (res) => {
      let data = "";
      res.on("data", (chunk) => { data += chunk; });
      res.on("end", () => {
        if (!settled) {
          settled = true;
          resolve({ status: res.statusCode, data });
        }
      });
    });

    req.on("timeout", () => {
      if (!settled) {
        settled = true;
        req.destroy();
        reject(new Error("Request timed out"));
      }
    });

    req.on("error", (err) => {
      if (!settled) {
        settled = true;
        reject(err);
      }
    });

    req.write(postData);
    req.end();
  });
}

function validatePayload(messages, temperature, maxTokens, modelLimits) {
  if (!Array.isArray(messages) || messages.length === 0) {
    return "messages must be a non-empty array";
  }
  if (messages.length > MAX_MESSAGES) {
    return `messages exceeds maximum length of ${MAX_MESSAGES}`;
  }
  for (const msg of messages) {
    if (!msg || typeof msg !== "object") return "each message must be an object";
    if (typeof msg.role !== "string" || !["system", "user", "assistant"].includes(msg.role)) {
      return "each message must have a valid role";
    }
    if (typeof msg.content !== "string") return "each message content must be a string";
    if (msg.content.length > MAX_MESSAGE_LENGTH) {
      return `message content exceeds ${MAX_MESSAGE_LENGTH} characters`;
    }
  }
  if (temperature !== undefined) {
    if (typeof temperature !== "number" || Number.isNaN(temperature)) {
      return "temperature must be a number";
    }
    if (temperature < 0 || temperature > modelLimits.temperatureMax) {
      return `temperature must be between 0 and ${modelLimits.temperatureMax}`;
    }
  }
  if (maxTokens !== undefined) {
    if (typeof maxTokens !== "number" || !Number.isInteger(maxTokens)) {
      return "max_tokens must be an integer";
    }
    if (maxTokens < 1 || maxTokens > modelLimits.maxTokens) {
      return `max_tokens must be between 1 and ${modelLimits.maxTokens}`;
    }
  }
  return null;
}

export async function handleLlmExecute(req, res, next) {
  const apiKey = getApiKey();

  try {
    const { engine, messages, temperature, max_tokens } = req.body || {};

    if (!engine || !messages || !Array.isArray(messages)) {
      res.status(400).json({ ok: false, error: "engine and messages[] are required." });
      return;
    }

    const model = MODEL_MAP[engine] || MODEL_MAP.claude;
    const modelLimits = MODEL_LIMITS[model];

    const validationError = validatePayload(messages, temperature, max_tokens, modelLimits);
    if (validationError) {
      res.status(400).json({ ok: false, error: validationError });
      return;
    }

    const defaultMaxTokens = modelLimits.maxTokens;

    const response = await httpsPost(NVIDIA_API_URL, {
      model,
      messages,
      temperature: temperature || 0.7,
      max_tokens: max_tokens || defaultMaxTokens,
      stream: false
    }, {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`
    });

    if (response.status !== 200) {
      res.status(response.status).json({ ok: false, error: `Provider error: ${response.data}` });
      return;
    }

    const data = JSON.parse(response.data);
    const content = data.choices?.[0]?.message?.content || "";
    const tokens = data.usage?.total_tokens || 0;

    res.json({
      ok: true,
      content,
      tokens,
      model,
      engine
    });
  } catch (error) {
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: error.message });
    }
  }
}
