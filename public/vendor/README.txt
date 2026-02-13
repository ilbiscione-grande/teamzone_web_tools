Place local vendor scripts for offline-safe client features here.

For PDF export without external CDN dependency, add:
  public/vendor/jspdf.umd.min.js

Expected source file name:
  jspdf.umd.min.js

Current app behavior:
1) Tries local file at /vendor/jspdf.umd.min.js
2) Falls back to CDN if local file is missing
