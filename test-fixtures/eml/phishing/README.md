# Phishing EML Samples

Place real phishing `.eml` files here. Public dataset files are downloaded via `scripts/download-test-eml.sh` and gitignored.

## Handling

- Sanitize recipient addresses before committing
- Keep sender addresses intact (they are the phishing actor)
- Add a companion `.meta.json` for each file
