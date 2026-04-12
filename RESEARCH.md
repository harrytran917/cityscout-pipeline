# Portal Research — Austin, TX

## Austin Build + Connect (ABC)
https://abc.austintexas.gov/web/permit/public-search-other

-Platform identification: Runs on Accela Citizen Access. Confirmed by the `/CitizenAccess/` URL path, Accela JS references in the page source, and the standard Accela search UI layout. Also cross-referenced with the Accela customer list.
-Access method: Search by address, permit number, or applicant. Covers building permits, trade permits, and planning cases like rezonings and site plans. Uses ASP.NET form submissions and server-side pagination — no JSON API endpoints in the network tab.
-Data available: permit number, address, project name, type, status, dates, contractor info. Planning cases also include applicant name and council district.
-Attachments: Some records have PDFs but it's inconsistent. Active cases with public hearings usually have them, older stuff mostly doesn't. Links appear accessible without login but may be tied to session state, so bulk downloading would be tricky.
-Estimated volume: ~10-15k planning cases from 2020 to present, based on browsing search results and filtering by date range.
-Limitations & gotchas: No public API. Internal Accela endpoints need a session cookie so not usable for a pipeline. Planning cases are only in ABC — no bulk export, would need scraping. Attachment availability is inconsistent, no clear pattern for which records have them.

## Austin Open Data Portal
https://data.austintexas.gov

-Platform identification: Socrata-based. Visible from the standard Socrata UI and `/resource/` API path structure.
-Data available: Building permits dataset with ~250k records going back to 2015.
-Access method: Has a real API. `GET https://data.austintexas.gov/resource/3syk-w9eu.json`. No key needed but has rate limits otherwise. Supports filtering and pagination. Easiest path for bulk permit data.
-Attachments: N/A, data only.
-Estimated volume: ~75-100k building permits from 2020 to present.
-Limitations & gotchas: Nightly batch export so it's a day or two behind. Planning cases are not included. Some older records only have a parcel ID with no street address. Field names don't always match what ABC shows in the UI.

## Austin Land Use Explorer
https://gis.austintexas.gov/austinlanduse/

-Platform identification: ArcGIS Hub.
-Data available: Zoning and land use by parcel. Not a permit or planning case tracker — no case numbers, no status, no applicant info.
-Access method: Map UI only, no useful API endpoints for permit data.
-Attachments: N/A.
-Estimated volume: N/A.
-Limitations & gotchas: Not useful for this pipeline. Included here because it shows up early in search results, worth knowing it's a dead end.

No separate planning document portal found — planning case documents appear to be embedded within ABC records only.

For a pipeline I'd use the Socrata API for building permits and scrape ABC for planning cases. The GIS tools aren't useful here.
