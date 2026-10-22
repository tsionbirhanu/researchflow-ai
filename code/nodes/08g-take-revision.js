// 08g Take Revision: use the revised report; keep the draft if the revision failed or was cut off.
const res = $input.first().json;
const revised = res.stop_reason === 'max_tokens' ? '' : responseText(res);
const { draft_report } = $('08c Parse Verification').first().json;
return [{ json: { final_markdown: revised.length >= 200 ? revised : draft_report, revised: revised.length >= 200 } }];
