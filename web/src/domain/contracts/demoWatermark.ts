export const DEMO_WATERMARK_TEXT = "DOCUMENTO DEMO SIN VALIDEZ";

export function applyDemoWatermark(html: string): string {
  return `
<div style="position:relative;">
  <div style="
    position:fixed;
    inset:0;
    display:flex;
    align-items:center;
    justify-content:center;
    pointer-events:none;
    z-index:9999;
    transform:rotate(-24deg);
    opacity:0.18;
    font-size:48px;
    font-weight:700;
    color:#7c3aed;
    letter-spacing:2px;
  ">
    ${DEMO_WATERMARK_TEXT}
  </div>
  ${html}
</div>`;
}

