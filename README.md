# cityscout-pipeline

Take-home assignment for CityScout AI Engineer internship.

## Setup

```bash
npm install
cp .env.example .env
# add your Anthropic API key to .env
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

`x_coord`/`y_coord` — some RES permits store coordinates under these keys instead of `lat`/`lng`. Based on the values in the data they're clearly lat/lng so I mapped them directly. Worth flagging as an assumption.

What I'd improve with more time — the project type fallback could use an LLM call to normalize types that don't match any category (e.g. "Accessory Structure", "Change of Use"). Right now those just pass through as-is.

## AI tools & process

Used Claude to help write the field normalization boilerplate, date parsing regexes, and the status/type lookup tables.

The trickier decisions I worked out myself. For dedup I had to decide what "most complete" actually means in practice and how to handle conflicts when both records have a value for the same field. I also decided whether to null out unmapped project types the same way I did for statuses. I kept the original value instead since knowing a project is some type we haven't seen before is still useful, whereas an unrecognized status doesn't mean much without context. Also renamed x_coord and y_coord fields from RES permits to latitude and longitude for clarity.
