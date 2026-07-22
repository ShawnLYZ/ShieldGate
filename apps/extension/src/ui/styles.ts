export const PANEL_CSS = `
:host { all: initial; }
.sg-banner { position: fixed; top: 0; left: 0; right: 0; z-index: 2147483646;
  font: 12px system-ui; padding: 4px 10px; color: #fff; display: flex; gap: 8px; align-items: center; }
.sg-banner.t0 { background: #b42318; } .sg-banner.t1 { background: #b54708; } .sg-banner.t2 { background: #067647; }
.sg-overlay { position: fixed; inset: 0; z-index: 2147483647; background: rgba(0,0,0,.45);
  display: flex; align-items: center; justify-content: center; font: 14px system-ui; }
.sg-panel { background: #fff; color: #101828; max-width: 560px; width: 90%; border-radius: 12px;
  padding: 20px; box-shadow: 0 20px 40px rgba(0,0,0,.3); }
.sg-panel h2 { margin: 0 0 8px; font-size: 16px; }
.sg-diff { background: #f9fafb; border: 1px solid #eaecf0; border-radius: 8px; padding: 10px;
  white-space: pre-wrap; word-break: break-word; margin: 12px 0; }
.sg-diff mark { background: #fee4e2; color: #b42318; border-radius: 3px; }
.sg-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.sg-actions button { font: 13px system-ui; padding: 8px 12px; border-radius: 8px; border: 1px solid #d0d5dd; cursor: pointer; }
.sg-primary { background: #067647; color: #fff; border-color: #067647 !important; }
.sg-coaching { background: #eff8ff; border: 1px solid #b2ddff; border-radius: 8px; padding: 10px; margin: 12px 0; }
.sg-suggestion { background: #fffaeb; border: 1px solid #fedf89; border-radius: 8px; padding: 8px 10px; margin: 8px 0; font-size: 13px; }
.sg-toast { position: fixed; bottom: 20px; right: 20px; z-index: 2147483647; font: 13px system-ui; }
.sg-toast-body { background: #101828; color: #fff; border-radius: 8px; padding: 10px 14px; box-shadow: 0 10px 20px rgba(0,0,0,.25); }
`;
