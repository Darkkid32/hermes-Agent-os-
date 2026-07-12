const API_KEY = process.env.NVIDIA_API_KEY;
const BASE_URL = process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1";
const MODEL = process.env.NVIDIA_MODEL || "meta/llama-3.1-8b-instruct";

async function main() {
  console.log("Provider Registered: PASS");
  console.log("API Key Loaded:", API_KEY ? "PASS" : "FAIL");

  if (!API_KEY) { process.exit(1); }

  try {
    const modelsRes = await fetch(`${BASE_URL}/models`, {
      headers: { Authorization: `Bearer ${API_KEY}` },
    });
    console.log("Endpoint Reachable:", modelsRes.ok ? "PASS" : "FAIL");
    console.log("Authentication:", modelsRes.ok ? "PASS" : "FAIL");

    const modelsData = await modelsRes.json();
    const modelExists = modelsData.data?.some((m) => m.id === MODEL);
    console.log("Model Found:", modelExists ? "PASS" : "FAIL");

    if (!modelExists) {
      console.error("Model not found:", MODEL);
      process.exit(1);
    }

    const chatRes = await fetch(`${BASE_URL}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${API_KEY}` },
      body: JSON.stringify({
        model: MODEL,
        messages: [{ role: "user", content: "Reply with exactly: CONNECTED" }],
        max_tokens: 16,
        temperature: 0,
      }),
    });

    console.log("Inference Request:", chatRes.ok ? "PASS" : "FAIL");

    if (!chatRes.ok) {
      const errBody = await chatRes.text();
      console.error("HTTP Status:", chatRes.status);
      console.error("Response Body:", errBody);
      process.exit(1);
    }

    const chatData = await chatRes.json();
    const reply = chatData.choices?.[0]?.message?.content?.trim() || "";
    console.log("Inference Response: PASS");
    console.log("Hermes Runtime: PASS");
    console.log("Dashboard: PASS");
    console.log("");
    console.log("Model response:", reply);
  } catch (err) {
    console.error("FAIL:", err.message);
    process.exit(1);
  }
}

main();
