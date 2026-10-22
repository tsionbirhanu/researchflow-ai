// E06 Parse Failure Email: use the AI email, or a fixed one if that call failed.
const ctx = $('E03 Build Failure Context').first().json;
let email;
try {
  email = parseJson(responseText($input.first().json), 'Failure email');
} catch (e) {
  email = {};
}
if (!email.subject || !email.body_html) {
  email = {
    subject: `Your research request could not be completed`,
    body_html:
      `<p>Hi,</p><p>Sorry, we could not finish your research on <strong>${esc(ctx.topic)}</strong>.</p>` +
      `<p>Please try again in a few minutes, or try a more specific topic or fewer sources.</p>` +
      `<p>AI Research Pipeline</p>`,
  };
}
return [{ json: email }];
