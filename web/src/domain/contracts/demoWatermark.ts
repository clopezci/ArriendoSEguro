export const DEMO_WATERMARK_TEXT = "arriendoseguro.app · vista demo";

export function applyDemoWatermark(html: string): string {
  return `
<div style="position:relative;">
  <div style="
    position:absolute;
    inset:0;
    display:flex;
    align-items:center;
    justify-content:center;
    pointer-events:none;
    z-index:1;
    transform:rotate(-24deg);
    opacity:0.10;
    font-size:40px;
    font-weight:700;
    color:#7c3aed;
    letter-spacing:2px;
  ">
    ${DEMO_WATERMARK_TEXT}
  </div>
  ${html}
</div>`;
}

