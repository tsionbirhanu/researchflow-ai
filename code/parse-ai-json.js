// Code node: safe JSON parse of AI output
const raw = $input.first().json.text || $input.first().json.output || "";
const clean = raw.replace(/```json|```/g, "").trim();
let parsed;
try {
  parsed = JSON.parse(clean);
} catch (e) {
  throw new Error("AI returned invalid JSON: " + clean.slice(0, 300));
}
return [{ json: parsed }];
