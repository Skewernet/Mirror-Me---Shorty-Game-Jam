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
