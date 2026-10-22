// Code node: safe JSON parse of AI output
// Claude responses can contain thinking blocks before the answer, so read the text blocks.
const res = $input.first().json;
const raw = (res.content || []).filter(b => b.type === "text").map(b => b.text).join("")
  || res.text || res.output || "";
const clean = raw.replace(/```json|```/g, "").trim();
const start = clean.indexOf("{");
const end = clean.lastIndexOf("}");
let parsed;
try {
  parsed = JSON.parse(start >= 0 && end > start ? clean.slice(start, end + 1) : clean);
} catch (e) {
  throw new Error("AI returned invalid JSON: " + clean.slice(0, 300));
}
return [{ json: parsed }];
