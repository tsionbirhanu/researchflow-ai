// 04d2 Split URLs: one item per page to download (SearXNG path).
// Always emits at least one item so the workflow continues to 04e even with no URLs.
const { urls_to_extract } = $input.first().json;
const urls = urls_to_extract.length ? urls_to_extract : ['about:blank'];
return urls.map(url => ({ json: { url } }));
