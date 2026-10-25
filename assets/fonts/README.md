# Local horror typography

The game uses two freely licensed fonts, served entirely from this repository:

- **Rubik Dirt** — copyright 2020 The Rubik Filtered Project Authors;
  design by Hubert & Fischer / NaN. SIL Open Font License 1.1.
  Source: <https://github.com/google/fonts/tree/main/ofl/rubikdirt>.
- **Special Elite** — copyright 2010 Brian J. Bonislawsky DBA Astigmatic
  (AOETI). Apache License 2.0.
  Source: <https://github.com/google/fonts/tree/main/apache/specialelite>.

`RubikDirt-latin.woff` retains uppercase Latin, numerals and title punctuation.
`SpecialElite-latin.woff` retains Latin-1, ordinary punctuation and supported
control-key symbols. The original outlines are unchanged. Both files were
subsetted and compressed to WOFF with fontTools; original font name/copyright
metadata and both complete licenses are retained. `sources.json` records the
downloaded TTF and shipped WOFF SHA-256 hashes.

The title font is deliberately limited to short uppercase headings. Distressed
typewriter text supplies the more readable gameplay captions and controls.
No font is fetched from a CDN at runtime.

## Supplied studio display face

**Skewer Blade Regular, Version 0.20** is supplied by Skewer Games / Skewernet
for the jam and title splash headings. It is separate from the two freely
licensed UI fonts above; no separate asset-license grant was supplied.
`SkewerBlade-Regular.woff2` is losslessly packaged from the provided TTF using
fontTools, without subsetting or editing its glyphs, names, metrics, kerning or
ligatures. All 100 character mappings remain. Upload/output hashes and the
approved original studio PNG are recorded in
`../art/skewer-brand-sources.json`. No remote font service is used.

The splash-specific face adjusts browser line metrics for the regular alphabet
(the font includes tall private-use logo symbols). It does not replace readable
body/settings text or the existing main-menu title face. The studio splash uses
the original textured PNG rather than reconstructing the logo with font glyphs.
