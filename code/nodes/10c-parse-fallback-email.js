// 10c Parse Fallback Email: use the AI email, or a fixed one if that call failed.
const r = $('02 Validate').first().json;
let email;
try {
  email = parseJson(responseText($input.first().json), 'Fallback email');
} catch (e) {
  email = {};
}
if (!email.subject || !email.body_html) {
  email = {
    subject: `Not enough reliable sources for: ${r.topic}`,
    body_html:
      `<p>Hi,</p><p>We searched for <strong>${esc(r.topic)}</strong> but found too few reliable sources ` +
      `to write a trustworthy report.</p><p>Try a broader or reworded topic, or a longer source age limit, ` +
      `and submit the form again.</p><p>AI Research Pipeline</p>`,
  };
}
return [{ json: { ...email, kept_count: $('10a Build Fallback Request').first().json.kept_count } }];
