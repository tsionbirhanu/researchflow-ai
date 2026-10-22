# Testing Checklist

- [ ] Normal topic runs end to end
- [ ] Very niche topic (few sources) triggers the fallback email
- [ ] Invalid or empty email is rejected with a clear message
- [ ] Paywalled or broken URL is skipped without crashing
- [ ] Fact-checker catches a deliberately planted false claim
- [ ] PDF opens cleanly on desktop and mobile
- [ ] Google Sheet row updates from `started` to `completed`
- [ ] Failure email sends when a stage breaks
- [ ] Quick, Standard, and Deep modes each stay within the timeout
