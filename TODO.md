- [x] Inspect hair.html and face.html Firebase subscription logic
- [x] Patch hair.html: merge subscription payload into local ledger; skip empty payloads; avoid wiping full ledger with partial updates
- [x] Patch face.html: merge subscription payload into local ledger; skip empty payloads; avoid wiping full ledger with partial updates
- [ ] Patch remaining similar pages (e.g. beard.html) if they use subscribeStateFromCloud similarly
- [ ] Manual test: reload pages repeatedly + simulate reconnect/offline; verify full sections render

