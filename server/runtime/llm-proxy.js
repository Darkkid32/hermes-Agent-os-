import https from "node:https";

const NVIDIA_API_KEY = "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";
const NVIDIA_API_URL = "https://integrate.api.nvidia.com/v1/chat/completions";

const MODEL_MAP = {
  claude: "meta/llama-3.1-70b-instruct",
  gemini: "google/gemma-2-2b-it",
  codex: "meta/llama-3.1-8b-instruct",
  openclaw: "nvidia/nemotron-mini-4b-instruct",
  opencode: "nvidia/nemotron-mini-4b-instruct",
  "free-claude-code": "meta/llama-3.1-8b-instruct"
};

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

export async function handleLlmExecute(req, res, next) {
  try {
    const { engine, messages, temperature, max_tokens } = req.body || {};

    if (!engine || !messages || !Array.isArray(messages)) {
      res.status(400).json({ ok: false, error: "engine and messages[] are required." });
      return;
    }

    const model = MODEL_MAP[engine] || MODEL_MAP.claude;

    // nemotron-mini has a lower max_tokens limit
    const defaultMaxTokens = model === "nvidia/nemotron-mini-4b-instruct" ? 512 : 4096;

    console.log(`[llm-proxy] Executing: engine=${engine}, model=${model}, messages=${messages.length}`);

    const response = await httpsPost(NVIDIA_API_URL, {
      model,
      messages,
      temperature: temperature || 0.7,
      max_tokens: max_tokens || defaultMaxTokens,
      stream: false
    }, {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${NVIDIA_API_KEY}`
    });

    console.log(`[llm-proxy] Response status: ${response.status}`);

    if (response.status !== 200) {
      console.error(`[llm-proxy] Provider error: ${response.data.substring(0, 500)}`);
      res.status(response.status).json({ ok: false, error: `Provider error: ${response.data}` });
      return;
    }

    const data = JSON.parse(response.data);
    const content = data.choices?.[0]?.message?.content || "";
    const tokens = data.usage?.total_tokens || 0;

    console.log(`[llm-proxy] Success: tokens=${tokens}, contentLength=${content.length}`);

    res.json({
      ok: true,
      content,
      tokens,
      model,
      engine
    });
  } catch (error) {
    console.error(`[llm-proxy] Error: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).json({ ok: false, error: error.message });
    }
  }
}
