// ==UserScript==
// @name         HiBob – Auto "Working Time" reason
// @namespace    efg-event-it
// @version      1.0
// @description  Automatically selects "Working Time" as the Reason on each attendance entry in HiBob.
// @match        https://app.hibob.com/attendance/my-attendance*
// @run-at       document-idle
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const REASON_TEXT = 'working time';          // match is case-insensitive
  const ENTRY_SEL   = 'app-attendance-entry';
  const SELECT_SEL  = 'b-single-select.reason-code-list';
  const OPTION_SEL  = '.cdk-overlay-container .option[role="treeitem"]';

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const handled = new WeakSet();               // entries already processed
  let busy = false;                            // only one dropdown open at a time

  async function fillEntry(entry) {
    const select = entry.querySelector(SELECT_SEL);
    if (!select) return false;                 // entry not fully rendered yet

    const display = select.querySelector('.bfe-input');
    if (display && display.textContent.trim()) {
      handled.add(entry);                      // already has a reason – leave it alone
      return true;
    }

    // The reason field lives inside a collapsed <details> ("Add a reason or note").
    const details = select.closest('details');
    if (details && !details.open) details.open = true;

    const trigger = select.querySelector('[aria-haspopup]');
    if (!trigger) return false;
    trigger.click();

    // Options are rendered in an Angular CDK overlay at the end of <body>.
    let option = null;
    for (let i = 0; i < 30 && !option; i++) {
      await sleep(100);
      option = [...document.querySelectorAll(OPTION_SEL)]
        .find((o) => o.textContent.trim().toLowerCase() === REASON_TEXT);
    }

    if (!option) {
      document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      console.warn('[HiBob auto-reason] "Working Time" option not found');
      return false;
    }

    option.click();
    handled.add(entry);
    await sleep(150);
    return true;
  }

  async function scan() {
    if (busy) return;
    busy = true;
    try {
      for (const entry of document.querySelectorAll(ENTRY_SEL)) {
        if (!handled.has(entry)) await fillEntry(entry);
      }
    } finally {
      busy = false;
    }
  }

  // HiBob is a single-page app and the entry panel is created on demand,
  // so watch the DOM and react when new entries appear.
  let timer = null;
  new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(scan, 300);             // debounce bursts of Angular rendering
  }).observe(document.body, { childList: true, subtree: true });

  scan();
})();