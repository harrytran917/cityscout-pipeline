require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');

const client = new OpenAI({
  baseURL: 'https://models.github.ai/inference',
  apiKey: process.env.GITHUB_TOKEN,
});

const MODEL = 'openai/gpt-4o';

const VALID_ROLES = new Set([
  'Owner', 'Applicant', 'Developer', 'Architect', 'Civil Engineer',
  'Surveyor', 'Landscape Architect', 'Contractor', 'Traffic Engineer',
  'Attorney', 'Structural Engineer', 'MEP Engineer', 'Environmental Consultant', 'Other',
]);

function buildPrompt(text) {
  return `Extract all professionals mentioned in this document.

Return a JSON array of objects. Each object should have these fields:
- name: full name as written in the document (include credentials like PE, AIA if present)
- role: must be one of: ${[...VALID_ROLES].join(', ')}
- firm: company or firm name
- phone: phone number as written
- email: email address
- license_number: license or registration number only (no label, e.g. "112847" not "TN LICENSE NO. 112847")
- license_state: two-letter state abbreviation

Set any missing field to null. Do not guess. If a role doesn't fit any of the valid options use "Other".

Return only the JSON array with no other text.

Document:
${text}`;
}

async function callWithRetry(doc, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await client.chat.completions.create({
        model: MODEL,
        max_tokens: 4096,
        messages: [{ role: 'user', content: buildPrompt(doc.text) }],
      });

      const raw = response.choices[0].message.content.trim();

      let professionals;
      try {
        professionals = JSON.parse(raw);
      } catch {
        const match = raw.match(/\[[\s\S]*\]/);
        if (!match) throw new Error('unparseable response');
        professionals = JSON.parse(match[0]);
      }

      // clamp any role the model made up to "Other"
      for (const p of professionals) {
        if (p.role && !VALID_ROLES.has(p.role)) p.role = 'Other';
      }

      return { document_id: doc.id, professionals };
    } catch (err) {
      if (attempt === retries) throw err;
      const wait = 2 ** attempt * 1000;
      console.warn(`  attempt ${attempt} failed, retrying in ${wait / 1000}s...`);
      await new Promise(res => setTimeout(res, wait));
    }
  }
}

async function main() {
  const docs = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'document-extracts.json'), 'utf8')
  );

  const results = [];

  for (const doc of docs) {
    console.log(`extracting ${doc.id} (${doc.type})...`);
    try {
      const result = await callWithRetry(doc);
      console.log(`  ${result.professionals.length} professionals found`);
      results.push(result);
    } catch (err) {
      console.error(`  failed after retries: ${err.message}`);
      results.push({ document_id: doc.id, professionals: [], error: err.message });
    }
  }

  fs.writeFileSync(
    path.join(__dirname, 'professionals.json'),
    JSON.stringify(results, null, 2)
  );

  console.log('done, wrote professionals.json');
}

main();
