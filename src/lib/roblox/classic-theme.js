// Presentation only: the current Roblox site supplies its real pages and controls.
export const CLASSIC_THEME_CSS = `
html.velblox-classic body {
  --color-surface-0: #e3e3e3 !important;
  --color-surface-100: #f2f2f2 !important;
  --color-surface-200: #fff !important;
  --color-surface-300: #f5f5f5 !important;
  --color-content-default: #343434 !important;
  --color-content-emphasis: #191919 !important;
  --color-content-muted: #666 !important;
  --color-content-link: #0074bd !important;
  --color-action-emphasis-background: #0074bd !important;
  --color-action-standard-background: #f2f2f2 !important;
  --color-action-standard-foreground: #343434 !important;
  --color-action-sub-emphasis-background: #fff !important;
  --color-action-sub-emphasis-foreground: #343434 !important;
  --color-action-link-foreground: #0074bd !important;
  --color-stroke-default: #ccc !important;
  --color-stroke-emphasis: #aaa !important;
  --color-stroke-contrast-alpha: #bbb !important;
  --config-theme-text-font: Arial, Helvetica, sans-serif !important;
  --radius-small: 3px !important;
  --radius-medium: 3px !important;
  --radius-large: 3px !important;
  color-scheme: light !important;
  background: #e3e3e3 !important;
  color: #343434 !important;
  font: 14px/1.45 Arial, Helvetica, sans-serif !important;
}
html.velblox-classic :is(h1,h2,h3,h4,button,input,select,textarea) {
  font-family: Arial, Helvetica, sans-serif !important;
}
html.velblox-classic #header.rbx-header {
  background: #0074bd !important;
  border: 0 !important;
  border-bottom: 1px solid #005b94 !important;
  box-shadow: 0 1px 3px #0002 !important;
  color: #fff !important;
}
html.velblox-classic #header :is(.rbx-navbar a,.navbar-brand,#velora-navigation-note) {
  color: #fff !important;
}
html.velblox-classic #header .rbx-navbar a:hover {
  background: #0064a3 !important;
}
html.velblox-classic #header .navbar-search {
  background: #fff !important;
  border: 1px solid #005b94 !important;
  border-radius: 3px !important;
}
html.velblox-classic #header .navbar-search input {
  background: #fff !important;
  color: #343434 !important;
  border-radius: 3px !important;
}
html.velblox-classic #header .navbar-search input::placeholder { color: #777 !important; }
html.velblox-classic #header .navbar-search .input-group-btn { background: #fff !important; }
html.velblox-classic #header .navbar-search [class*=icon] { filter: brightness(.4); }
html.velblox-classic #header #sign-up-button {
  background: #008f3c !important;
  color: #fff !important;
  border: 1px solid #00752f !important;
  border-radius: 3px !important;
}
html.velblox-classic .rbx-left-col {
  background: #f5f5f5 !important;
  color: #343434 !important;
  border-right: 1px solid #ccc !important;
}
html.velblox-classic .rbx-left-col a { color: #343434 !important; }
html.velblox-classic .rbx-left-col a:hover { background: #e5e5e5 !important; }
html.velblox-classic .rbx-left-col [class*=icon] { filter: brightness(.35); }
html.velblox-classic #container-main {
  background: transparent !important;
  color: #343434 !important;
}
html.velblox-classic #container-main :is(h1,h2,h3,h4,.game-card-name,.text-name,.text-lead) {
  color: #343434 !important;
}
html.velblox-classic #container-main :is(.text-secondary,.text-description,.game-card-info) {
  color: #666 !important;
}
html.velblox-classic #container-main a:not([class*=btn]):not([role=button]) { color: #0074bd; }
html.velblox-classic :is(.section-content,.section,.game-details-container .section-content) {
  background: #fff !important;
  color: #343434 !important;
  border: 1px solid #ccc !important;
  border-radius: 0 !important;
  box-shadow: none !important;
}
html.velblox-classic :is(.game-card-container,.game-card-thumb-container,.game-card .thumbnail-2d-container) {
  border-radius: 0 !important;
}
html.velblox-classic :is(.foundation-web-button,.filter-select) {
  border-radius: 3px !important;
}
html.velblox-classic .filter-select {
  background: linear-gradient(#fff,#ededed) !important;
  color: #343434 !important;
  border: 1px solid #aaa !important;
}
html.velblox-classic :is(.btn-control-md,.btn-control-sm,.btn-secondary-md,.btn-secondary-sm) {
  background: #fff !important;
  color: #343434 !important;
  border: 1px solid #aaa !important;
  border-radius: 3px !important;
  box-shadow: 0 1px 1px #0001 !important;
}
html.velblox-classic :is(.btn-common-play-game-lg,[data-testid=play-button]) {
  background: #008f3c !important;
  color: #fff !important;
  border: 1px solid #00752f !important;
  border-radius: 3px !important;
}
html.velblox-classic .btn-common-play-game-lg::after {
  content: 'Play';
  margin-left: 10px;
  font: 700 20px/1 Arial,Helvetica,sans-serif;
}
html.velblox-classic :is(.rbx-tabs-horizontal,.nav-tabs) { background: #fff !important; }
html.velblox-classic :is(.rbx-tab a,.nav-tabs a) { color: #343434 !important; }
html.velblox-classic :is(.rbx-tab.active,.nav-tabs .active) {
  border-bottom-color: #0074bd !important;
}
html.velblox-classic .footer-container {
  background: #fff !important;
  color: #666 !important;
  border-top: 1px solid #ccc !important;
}
html.velblox-classic .footer-container a { color: #555 !important; }
html.velblox-classic :is(.login-content-wrapper,.login-base-container) {
  background: transparent !important;
}
html.velblox-classic #background-image {
  background: #e3e3e3 !important;
}
html.velblox-classic .login-foundation-wordmark {
  display: block !important;
  background: none !important;
  width: auto !important;
  height: auto !important;
  text-align: center !important;
}
html.velblox-classic .login-foundation-wordmark::before {
  content: 'VELBLOX';
  color: #e2231a;
  font: 900 44px/1.1 'Arial Black',Arial,sans-serif;
  letter-spacing: -2px;
  -webkit-text-stroke: 1px #fff;
  text-shadow: 1px 2px 0 #a00;
}
html.velblox-classic .login-foundation-card {
  background: #fff !important;
  color: #343434 !important;
  border: 1px solid #bbb !important;
  border-radius: 0 !important;
  box-shadow: 0 2px 4px #0001 !important;
}
html.velblox-classic .login-foundation-card h1 { font-size: 26px !important; }
html.velblox-classic .login-foundation-card .foundation-web-input {
  background: #fff !important;
  border: 1px solid #aaa !important;
  border-radius: 3px !important;
}
html.velblox-classic .login-foundation-card input { color: #343434 !important; }
html.velblox-classic .login-foundation-card .foundation-web-button {
  background: linear-gradient(#fff,#ededed) !important;
  color: #343434 !important;
  border: 1px solid #aaa !important;
  border-radius: 3px !important;
}
html.velblox-classic .login-foundation-card button[type=submit] {
  background: #0074bd !important;
  color: #fff !important;
  border-color: #005b94 !important;
}
html.velblox-classic .login-foundation-card button:disabled { opacity: .5 !important; }
`;
