/**
 * Termal (80mm) ve A4 önizleme için basit HTML fiş penceresi.
 * Tüm dinamik metinler escape edilmelidir.
 */
export function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const FIS_STYLES = `
  @page { size: 80mm auto; margin: 0; }
  * { box-sizing: border-box; }
  body {
    font-family: Consolas, "Courier New", monospace;
    font-size: 11px;
    margin: 0;
    padding: 8px 8px 28px 8px;
    color: #111;
  }
  .brand { font-size: 13px; font-weight: 700; letter-spacing: 0.02em; }
  .title { font-size: 12px; font-weight: 600; margin: 4px 0 2px; }
  .meta { font-size: 10px; color: #444; margin-bottom: 8px; }
  h2 {
    font-size: 11px;
    font-weight: 600;
    margin: 10px 0 4px;
    padding-bottom: 2px;
    border-bottom: 1px solid #999;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    margin: 0 0 4px;
  }
  th, td {
    border: 1px solid #333;
    padding: 3px 5px;
    vertical-align: top;
  }
  th {
    background: #eee;
    font-weight: 600;
    text-align: left;
  }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  .muted { color: #555; font-size: 10px; }
`;

/**
 * @param {string} documentTitle
 * @param {string} bodyInnerHtml - escape edilmiş parçalardan oluşmalı
 */
export function openFisWindow(documentTitle, bodyInnerHtml) {
  const safeTitle = escapeHtml(documentTitle);
  const html = `<!DOCTYPE html>
<html lang="tr">
  <head>
    <meta charset="utf-8" />
    <title>${safeTitle}</title>
    <style>${FIS_STYLES}</style>
  </head>
  <body>
    ${bodyInnerHtml}
    <script>
      window.onload = function () {
        window.print();
        setTimeout(function () { window.close(); }, 400);
      };
    </script>
  </body>
</html>`;
  const w = window.open("", "_blank", "width=420,height=720");
  if (!w) return false;
  w.document.open();
  w.document.write(html);
  w.document.close();
  return true;
}
