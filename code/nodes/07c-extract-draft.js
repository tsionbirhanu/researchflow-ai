// 07c Extract Draft: take the Markdown report, refusing to continue with a truncated one.
const res = $input.first().json;
if (res.stop_reason === 'max_tokens') throw new Error('Synthesize: the report was cut off before it finished.');
const draft_report = responseText(res);
if (draft_report.length < 200) throw new Error('Synthesize: the writer returned an empty report.');
return [{ json: { draft_report } }];
