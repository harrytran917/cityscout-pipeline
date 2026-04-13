# cityscout-pipeline

Take-home assignment for CityScout AI Engineer internship.

## Setup

```bash
npm install
cp .env.example .env
# open .env and add your GitHub token (needs Models read permission)
```

## Running

```bash
node transform.js   # reads raw-permits.json, outputs transformed.json
node extract.js     # reads document-extracts.json, outputs professionals.json
```

Node 18+ required.

## Decisions & tradeoffs

Deduplication — records with the same normalized address are merged. The most complete record (most non-null fields) is used as the base, and any missing fields are filled in from duplicates. If both records have a value for the same field, the one with the more recent `application_date` wins. This felt like the right call since an amended filing should supersede the original.

Unmapped statuses — if a status value doesn't match any of the known mappings it gets set to `null` rather than guessing. The original value is still in `raw_data` so nothing is lost.

Project types — same approach but slightly different: unmapped types keep their original value instead of going to `null`. A type we don't recognize is still useful, a status we don't recognize isn't.

## What I'd improve

The project type fallback could use an LLM call to normalize types that don't match any category (things like "Accessory Structure" or "Change of Use" just pass through as-is right now). I'd also add better logging around which records got merged and why, mostly just to make it easier to spot issues in the output.

## AI tools & process

Used Claude for the field normalization boilerplate and the status/type lookup tables — mostly just to move faster on the repetitive parts. The actual extraction in `extract.js` uses GPT-4o via GitHub Models. Iterated on the prompt a bit to get consistent output — the main thing was being explicit about when to use null vs make a judgment call on ambiguous roles, and making sure it returned a raw JSON array without any surrounding text.

The parts I had to work out myself: the dedup merge strategy, deciding what "most complete" actually means when two records conflict, and whether to null out unmapped project types the same way I did for statuses. That last one isn't obvious from the spec — keeping the original value felt more useful than losing the information entirely.
