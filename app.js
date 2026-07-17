/* =========================================================================
   Typewriter Studio — app.js
   Vanilla JS, zero dependencies, zero network calls after the page loads.
   Apache License 2.0 — Tukaram Hankare, Solapur, Maharashtra, India.
   ========================================================================= */
(function () {
  'use strict';

  /* ---------------------------------------------------------------------
     Constants
     ------------------------------------------------------------------- */
  var STORAGE_KEY = 'typewriterStudio.settings.v1';

  // Must match the <option value="..."> strings in index.html exactly.
  var FONT_MONO       = "ui-monospace, 'Cascadia Code', 'Courier New', monospace";
  var FONT_SERIF      = "Georgia, 'Times New Roman', serif";
  var FONT_SANS       = "-apple-system, 'Segoe UI', Roboto, Arial, sans-serif";
  var FONT_ROUNDED    = "'Trebuchet MS', Verdana, sans-serif";
  var FONT_TYPEWRITER = "'Courier New', Courier, monospace";
  var ALLOWED_FONTS   = [FONT_MONO, FONT_SERIF, FONT_SANS, FONT_ROUNDED, FONT_TYPEWRITER];

  var DEFAULT_DEMO_TEXT =
    'Type anything, watch it come alive.\n' +
    'Fully offline. Nothing leaves this device.\n' +
    'Style it, time it, then export the code.';

  var DEFAULTS = {
    phraseMode: 'rotating',
    text: '',
    hasCustomText: false,
    fontFamily: FONT_MONO,
    fontSize: 32,
    align: 'left',
    textColor: '#ede7de',
    bgColor: '#1c1814',
    cursorColor: '#d97757',
    typingSpeed: 60,
    deletingSpeed: 30,
    pauseAfterTyped: 1200,
    pauseAfterDeleted: 300,
    jitter: false,
    punctuationPause: true,
    loop: true,
    cursorChar: '|',
    cursorCustom: '',
    cursorBlink: true,
    blinkSpeed: 700,
    instantMode: false
  };

  var NUMERIC_RANGES = {
    fontSize: [14, 72],
    typingSpeed: [10, 300],
    deletingSpeed: [5, 200],
    pauseAfterTyped: [0, 4000],
    pauseAfterDeleted: [0, 2000],
    blinkSpeed: [300, 1500]
  };
  var BOOL_FIELDS = ['jitter', 'punctuationPause', 'loop', 'cursorBlink', 'instantMode', 'hasCustomText'];
  var ENUM_FIELDS = {
    phraseMode: ['single', 'rotating'],
    align: ['left', 'center', 'right'],
    cursorChar: ['|', '_', '\u258C', 'custom'],
    fontFamily: ALLOWED_FONTS
  };
  var COLOR_FIELDS = ['textColor', 'bgColor', 'cursorColor'];
  var FREE_STRING_FIELDS = { text: 5000, cursorCustom: 4 };
  var COLOR_RE = /^#[0-9a-fA-F]{6}$/;
  var PUNCTUATION = { ',': true, '.': true, '!': true, '?': true, ';': true, ':': true };

  var THEMES = {
    dark:     { fontFamily: FONT_MONO,       textColor: '#ede7de', bgColor: '#1c1814', cursorColor: '#d97757' },
    light:    { fontFamily: FONT_SANS,       textColor: '#22201c', bgColor: '#f4f1ea', cursorColor: '#c96442' },
    terminal: { fontFamily: FONT_TYPEWRITER, textColor: '#6fe27a', bgColor: '#0a0f0a', cursorColor: '#6fe27a' },
    neon:     { fontFamily: FONT_MONO,       textColor: '#f5f5f5', bgColor: '#150a1f', cursorColor: '#ff5fc4' }
  };

  /* ---------------------------------------------------------------------
     DOM references
     ------------------------------------------------------------------- */
  var el = {};
  function grab(id) { return document.getElementById(id); }

  /* ---------------------------------------------------------------------
     Mutable state
     ------------------------------------------------------------------- */
  var isShowingDemo = true;
  var storageAvailable = true;
  var hadSavedSettings = false;

  var phraseIndex = 0;
  var charIndex = 0;
  var isDeleting = false;
  var tickHandle = null;
  var playState = 'idle'; // 'idle' | 'running' | 'paused' | 'done'

  var saveTimer = null;
  var copyStatusTimer = null;

  /* ---------------------------------------------------------------------
     Small helpers
     ------------------------------------------------------------------- */
  function clampNum(value, min, max, fallback) {
    var num = Number(value);
    if (!Number.isFinite(num)) return fallback;
    return Math.min(max, Math.max(min, num));
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function validateField(key, value) {
    if (NUMERIC_RANGES[key]) {
      var range = NUMERIC_RANGES[key];
      return clampNum(value, range[0], range[1], DEFAULTS[key]);
    }
    if (BOOL_FIELDS.indexOf(key) !== -1) {
      return typeof value === 'boolean' ? value : DEFAULTS[key];
    }
    if (ENUM_FIELDS[key]) {
      return ENUM_FIELDS[key].indexOf(value) !== -1 ? value : DEFAULTS[key];
    }
    if (COLOR_FIELDS.indexOf(key) !== -1) {
      return (typeof value === 'string' && COLOR_RE.test(value)) ? value : DEFAULTS[key];
    }
    if (FREE_STRING_FIELDS.hasOwnProperty(key)) {
      if (typeof value !== 'string') return DEFAULTS[key];
      return value.slice(0, FREE_STRING_FIELDS[key]);
    }
    return DEFAULTS[key];
  }

  function testStorageAvailable() {
    try {
      var testKey = '__tw_studio_test__';
      window.localStorage.setItem(testKey, '1');
      window.localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  /* ---------------------------------------------------------------------
     Settings <-> controls
     ------------------------------------------------------------------- */
  function readSettingsFromControls() {
    return {
      phraseMode: el.phraseModeSelect.value,
      text: el.textInput.value,
      hasCustomText: !isShowingDemo,
      fontFamily: el.fontFamilySelect.value,
      fontSize: clampNum(el.fontSizeRange.value, 14, 72, DEFAULTS.fontSize),
      align: el.alignSelect.value,
      textColor: el.textColorInput.value,
      bgColor: el.bgColorInput.value,
      cursorColor: el.cursorColorInput.value,
      typingSpeed: clampNum(el.typingSpeedRange.value, 10, 300, DEFAULTS.typingSpeed),
      deletingSpeed: clampNum(el.deletingSpeedRange.value, 5, 200, DEFAULTS.deletingSpeed),
      pauseAfterTyped: clampNum(el.pauseTypedRange.value, 0, 4000, DEFAULTS.pauseAfterTyped),
      pauseAfterDeleted: clampNum(el.pauseDeletedRange.value, 0, 2000, DEFAULTS.pauseAfterDeleted),
      jitter: el.jitterCheckbox.checked,
      punctuationPause: el.punctuationPauseCheckbox.checked,
      loop: el.loopCheckbox.checked,
      cursorChar: el.cursorCharSelect.value,
      cursorCustom: el.cursorCustomInput.value,
      cursorBlink: el.cursorBlinkCheckbox.checked,
      blinkSpeed: clampNum(el.blinkSpeedRange.value, 300, 1500, DEFAULTS.blinkSpeed),
      instantMode: el.instantModeCheckbox.checked
    };
  }

  function applySettingsToControls(s) {
    el.phraseModeSelect.value = s.phraseMode;
    el.fontFamilySelect.value = ALLOWED_FONTS.indexOf(s.fontFamily) !== -1 ? s.fontFamily : DEFAULTS.fontFamily;
    el.fontSizeRange.value = s.fontSize;
    el.alignSelect.value = s.align;
    el.textColorInput.value = s.textColor;
    el.bgColorInput.value = s.bgColor;
    el.cursorColorInput.value = s.cursorColor;
    el.typingSpeedRange.value = s.typingSpeed;
    el.deletingSpeedRange.value = s.deletingSpeed;
    el.pauseTypedRange.value = s.pauseAfterTyped;
    el.pauseDeletedRange.value = s.pauseAfterDeleted;
    el.jitterCheckbox.checked = s.jitter;
    el.punctuationPauseCheckbox.checked = s.punctuationPause;
    el.loopCheckbox.checked = s.loop;
    el.cursorCharSelect.value = s.cursorChar;
    el.cursorCustomInput.value = s.cursorCustom;
    el.cursorCustomField.hidden = s.cursorChar !== 'custom';
    el.cursorBlinkCheckbox.checked = s.cursorBlink;
    el.blinkSpeedRange.value = s.blinkSpeed;
    el.instantModeCheckbox.checked = s.instantMode;
    updateOutputsDisplay(s);
  }

  function updateOutputsDisplay(s) {
    el.fontSizeValue.textContent = s.fontSize;
    el.typingSpeedValue.textContent = s.typingSpeed;
    el.deletingSpeedValue.textContent = s.deletingSpeed;
    el.pauseTypedValue.textContent = s.pauseAfterTyped;
    el.pauseDeletedValue.textContent = s.pauseAfterDeleted;
    el.blinkSpeedValue.textContent = s.blinkSpeed;
  }

  function loadSettings() {
    var saved = null;
    try {
      var raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) saved = JSON.parse(raw);
    } catch (e) {
      saved = null;
    }
    if (!saved || typeof saved !== 'object') {
      return JSON.parse(JSON.stringify(DEFAULTS));
    }
    hadSavedSettings = true;
    var merged = JSON.parse(JSON.stringify(DEFAULTS));
    Object.keys(DEFAULTS).forEach(function (key) {
      if (saved.hasOwnProperty(key)) {
        merged[key] = validateField(key, saved[key]);
      }
    });
    return merged;
  }

  function scheduleSave() {
    if (!storageAvailable) return;
    window.clearTimeout(saveTimer);
    saveTimer = window.setTimeout(function () {
      try {
        var s = readSettingsFromControls();
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
      } catch (e) {
        storageAvailable = false;
        el.saveIndicator.textContent = "Your browser is blocking local storage, so settings won't be remembered next visit.";
      }
    }, 400);
  }

  /* ---------------------------------------------------------------------
     Preview rendering
     ------------------------------------------------------------------- */
  function applyPreviewStyle(s) {
    var stage = el.previewStage;
    stage.style.setProperty('--preview-font', s.fontFamily);
    stage.style.setProperty('--preview-size', s.fontSize + 'px');
    stage.style.setProperty('--preview-color', s.textColor);
    stage.style.setProperty('--preview-bg', s.bgColor);
    stage.style.setProperty('--preview-cursor-color', s.cursorColor);
    stage.style.setProperty('--preview-align', s.align);
    stage.style.setProperty('--preview-blink-duration', s.blinkSpeed + 'ms');
    stage.style.textAlign = s.align;
    stage.style.justifyContent = s.align === 'center' ? 'center' : (s.align === 'right' ? 'flex-end' : 'flex-start');
  }

  function applyCursorChar(s) {
    var display = s.cursorChar === 'custom' ? (s.cursorCustom || '|') : s.cursorChar;
    el.previewCursor.textContent = display;
    if (s.cursorBlink) {
      el.previewCursor.classList.remove('no-blink');
    } else {
      el.previewCursor.classList.add('no-blink');
    }
  }

  function renderChars(str) {
    el.previewText.textContent = str;
  }

  function getPhrases() {
    var raw = el.textInput.value;
    var mode = el.phraseModeSelect.value;
    if (mode === 'rotating') {
      return raw.split('\n')
        .map(function (line) { return line.trim(); })
        .filter(function (line) { return line.length > 0; });
    }
    var trimmed = raw.trim();
    return trimmed.length > 0 ? [trimmed] : [];
  }

  /* ---------------------------------------------------------------------
     Status / button state
     ------------------------------------------------------------------- */
  function updateStatus(text) {
    el.statusText.textContent = text;
  }

  function refreshUI() {
    var hasText = getPhrases().length > 0;
    el.playBtn.disabled = !hasText || playState === 'running' || el.instantModeCheckbox.checked;
    el.pauseBtn.disabled = playState !== 'running';
    el.restartBtn.disabled = !hasText || el.instantModeCheckbox.checked;
    el.playBtn.textContent = playState === 'paused' ? '\u25B6 Resume' : '\u25B6 Play';
  }

  function invalidateExport() {
    el.exportOutput.value = '';
  }

  /* ---------------------------------------------------------------------
     Typing state machine
     ------------------------------------------------------------------- */
  function currentPhraseChars(phrases) {
    var phrase = phrases[phraseIndex] || '';
    return Array.from(phrase);
  }

  function computeDelay(baseMs, ch, opts) {
    var delay = baseMs;
    if (opts.jitter) {
      var variance = baseMs * 0.35;
      delay = baseMs + (Math.random() * 2 - 1) * variance;
    }
    if (opts.punctuationPause && !opts.deleting && ch && PUNCTUATION[ch]) {
      delay += baseMs * 6;
    }
    return Math.max(4, Math.round(delay));
  }

  function tick() {
    if (playState !== 'running') return;

    var phrases = getPhrases();
    if (phrases.length === 0) {
      playState = 'idle';
      updateStatus('Enter some text to see the typewriter effect.');
      refreshUI();
      return;
    }
    // Guard against phraseIndex drifting out of range if phrase count shrank.
    if (phraseIndex >= phrases.length) phraseIndex = 0;

    var settings = readSettingsFromControls();
    var chars = currentPhraseChars(phrases);
    var isLastPhrase = phraseIndex === phrases.length - 1;

    if (!isDeleting) {
      if (charIndex < chars.length) {
        charIndex++;
        renderChars(chars.slice(0, charIndex).join(''));
        var justTyped = chars[charIndex - 1];
        var delay = computeDelay(settings.typingSpeed, justTyped, { jitter: settings.jitter, punctuationPause: settings.punctuationPause, deleting: false });
        tickHandle = window.setTimeout(tick, delay);
        return;
      }
      // Finished typing this phrase in full.
      el.srFullText.textContent = phrases[phraseIndex];
      if (phrases.length === 1 && !settings.loop) {
        playState = 'done';
        updateStatus('Done');
        refreshUI();
        return;
      }
      if (isLastPhrase && !settings.loop) {
        playState = 'done';
        updateStatus('Done');
        refreshUI();
        return;
      }
      isDeleting = true;
      tickHandle = window.setTimeout(tick, settings.pauseAfterTyped);
      return;
    }

    // Deleting.
    if (charIndex > 0) {
      charIndex--;
      renderChars(chars.slice(0, charIndex).join(''));
      var delDelay = computeDelay(settings.deletingSpeed, null, { jitter: settings.jitter, punctuationPause: false, deleting: true });
      tickHandle = window.setTimeout(tick, delDelay);
      return;
    }
    // Finished deleting: advance to the next phrase.
    isDeleting = false;
    phraseIndex++;
    if (phraseIndex >= phrases.length) {
      if (!settings.loop) {
        playState = 'done';
        updateStatus('Done');
        refreshUI();
        return;
      }
      phraseIndex = 0;
    }
    tickHandle = window.setTimeout(tick, settings.pauseAfterDeleted);
  }

  function hardReset() {
    window.clearTimeout(tickHandle);
    tickHandle = null;
    phraseIndex = 0;
    charIndex = 0;
    isDeleting = false;
    playState = 'idle';
    renderChars('');
    el.srFullText.textContent = '';
    el.previewCursor.classList.remove('tw-hide');
    invalidateExport();
    updateStatus(getPhrases().length ? 'Ready' : 'Enter some text to see the typewriter effect.');
    refreshUI();
  }

  function startPlayback() {
    if (el.instantModeCheckbox.checked) return;
    var phrases = getPhrases();
    if (phrases.length === 0) {
      updateStatus('Enter some text to see the typewriter effect.');
      return;
    }
    if (playState === 'idle' || playState === 'done') {
      phraseIndex = 0;
      charIndex = 0;
      isDeleting = false;
      renderChars('');
    }
    window.clearTimeout(tickHandle);
    playState = 'running';
    updateStatus('Playing\u2026');
    refreshUI();
    tick();
  }

  function pausePlayback() {
    if (playState !== 'running') return;
    window.clearTimeout(tickHandle);
    tickHandle = null;
    playState = 'paused';
    updateStatus('Paused');
    refreshUI();
  }

  function restartPlayback() {
    window.clearTimeout(tickHandle);
    tickHandle = null;
    phraseIndex = 0;
    charIndex = 0;
    isDeleting = false;
    renderChars('');
    el.srFullText.textContent = '';
    if (el.instantModeCheckbox.checked) {
      renderInstantAndStop();
      return;
    }
    var phrases = getPhrases();
    if (phrases.length === 0) {
      playState = 'idle';
      updateStatus('Enter some text to see the typewriter effect.');
      refreshUI();
      return;
    }
    playState = 'running';
    updateStatus('Playing\u2026');
    refreshUI();
    tick();
  }

  function renderInstantAndStop() {
    window.clearTimeout(tickHandle);
    tickHandle = null;
    var phrases = getPhrases();
    var combined = phrases.join('\n');
    renderChars(combined);
    el.srFullText.textContent = combined;
    el.previewCursor.classList.add('tw-hide');
    playState = 'done';
    updateStatus(phrases.length ? 'Instant mode \u2014 animation off' : 'Enter some text to see the typewriter effect.');
    el.playBtn.disabled = true;
    el.pauseBtn.disabled = true;
    el.restartBtn.disabled = true;
  }

  /* ---------------------------------------------------------------------
     Export
     ------------------------------------------------------------------- */
  function buildEmbedCode() {
    var s = readSettingsFromControls();
    var phrases = getPhrases();
    var id = 'tw' + Math.random().toString(36).slice(2, 9);
    var cursorDisplay = escapeHtml(s.cursorChar === 'custom' ? (s.cursorCustom || '|') : s.cursorChar);
    var blinkRule = s.cursorBlink
      ? 'animation:tw-blink-' + id + ' ' + s.blinkSpeed + 'ms steps(1) infinite;'
      : 'animation:none;opacity:1;';

    return (
'<!-- Typewriter Studio embed \u2014 paste anywhere. Self-contained, no dependencies. -->\n' +
'<div id="' + id + '" style="display:inline-flex;align-items:center;font-family:' + s.fontFamily + ';font-size:' + s.fontSize + 'px;color:' + s.textColor + ';background:' + s.bgColor + ';text-align:' + s.align + ';padding:16px 20px;border-radius:8px;white-space:pre-wrap;overflow-wrap:break-word;">' +
'<span class="tw-text"></span><span class="tw-cursor" style="color:' + s.cursorColor + ';margin-left:1px;' + blinkRule + '">' + cursorDisplay + '</span>' +
'</div>\n' +
'<style>@keyframes tw-blink-' + id + '{0%,49%{opacity:1}50%,100%{opacity:0}}@media(prefers-reduced-motion:reduce){#' + id + ' .tw-cursor{animation:none;opacity:1}}</style>\n' +
'<script>\n' +
'(function(){\n' +
'  var root = document.getElementById(' + JSON.stringify(id) + ');\n' +
'  var textEl = root.querySelector(".tw-text");\n' +
'  var phrases = ' + JSON.stringify(phrases) + ';\n' +
'  var opts = {\n' +
'    typingSpeed: ' + s.typingSpeed + ',\n' +
'    deletingSpeed: ' + s.deletingSpeed + ',\n' +
'    pauseAfterTyped: ' + s.pauseAfterTyped + ',\n' +
'    pauseAfterDeleted: ' + s.pauseAfterDeleted + ',\n' +
'    jitter: ' + JSON.stringify(!!s.jitter) + ',\n' +
'    punctuationPause: ' + JSON.stringify(!!s.punctuationPause) + ',\n' +
'    loop: ' + JSON.stringify(!!s.loop) + '\n' +
'  };\n' +
'  var PUNCT = {",":1,".":1,"!":1,"?":1,";":1,":":1};\n' +
'  var phraseIndex = 0, charIndex = 0, isDeleting = false, handle = null;\n' +
'  function chars(p) { return Array.from(p || ""); }\n' +
'  function delay(base, ch, deleting) {\n' +
'    var d = base;\n' +
'    if (opts.jitter) { var v = base * 0.35; d = base + (Math.random() * 2 - 1) * v; }\n' +
'    if (opts.punctuationPause && !deleting && ch && PUNCT[ch]) { d += base * 6; }\n' +
'    return Math.max(4, Math.round(d));\n' +
'  }\n' +
'  function tick() {\n' +
'    if (!phrases.length) return;\n' +
'    var c = chars(phrases[phraseIndex]);\n' +
'    var isLast = phraseIndex === phrases.length - 1;\n' +
'    if (!isDeleting) {\n' +
'      if (charIndex < c.length) {\n' +
'        charIndex++;\n' +
'        textEl.textContent = c.slice(0, charIndex).join("");\n' +
'        handle = setTimeout(tick, delay(opts.typingSpeed, c[charIndex - 1], false));\n' +
'      } else {\n' +
'        if (phrases.length === 1 && !opts.loop) return;\n' +
'        if (isLast && !opts.loop) return;\n' +
'        isDeleting = true;\n' +
'        handle = setTimeout(tick, opts.pauseAfterTyped);\n' +
'      }\n' +
'    } else {\n' +
'      if (charIndex > 0) {\n' +
'        charIndex--;\n' +
'        textEl.textContent = c.slice(0, charIndex).join("");\n' +
'        handle = setTimeout(tick, delay(opts.deletingSpeed, null, true));\n' +
'      } else {\n' +
'        isDeleting = false;\n' +
'        phraseIndex++;\n' +
'        if (phraseIndex >= phrases.length) {\n' +
'          if (!opts.loop) return;\n' +
'          phraseIndex = 0;\n' +
'        }\n' +
'        handle = setTimeout(tick, opts.pauseAfterDeleted);\n' +
'      }\n' +
'    }\n' +
'  }\n' +
'  if (phrases.length) { tick(); }\n' +
'})();\n' +
'<\/script>'
    );
  }

  function flashCopyStatus(msg) {
    el.copyStatus.textContent = msg;
    window.clearTimeout(copyStatusTimer);
    copyStatusTimer = window.setTimeout(function () {
      el.copyStatus.textContent = '';
    }, 2500);
  }

  function copyExportOutput() {
    if (!el.exportOutput.value) {
      el.exportOutput.value = buildEmbedCode();
    }
    var text = el.exportOutput.value;

    function fallbackCopy() {
      try {
        el.exportOutput.focus();
        el.exportOutput.select();
        var ok = document.execCommand && document.execCommand('copy');
        flashCopyStatus(ok ? 'Copied!' : 'Select the text and press Ctrl/Cmd+C.');
      } catch (e) {
        flashCopyStatus('Select the text and press Ctrl/Cmd+C.');
      }
    }

    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(function () {
        flashCopyStatus('Copied!');
      }, fallbackCopy);
    } else {
      fallbackCopy();
    }
  }

  function downloadExportFile() {
    if (!el.exportOutput.value) {
      el.exportOutput.value = buildEmbedCode();
    }
    try {
      var blob = new Blob([el.exportOutput.value], { type: 'text/html' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'typewriter-embed.html';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    } catch (e) {
      flashCopyStatus('Download failed \u2014 try Copy code instead.');
    }
  }

  /* ---------------------------------------------------------------------
     Event wiring
     ------------------------------------------------------------------- */
  function onLiveControlChange() {
    var s = readSettingsFromControls();
    applyPreviewStyle(s);
    applyCursorChar(s);
    updateOutputsDisplay(s);
    invalidateExport();
    scheduleSave();
  }

  function onTextOrModeChange() {
    hardReset();
    scheduleSave();
    if (el.instantModeCheckbox.checked) {
      renderInstantAndStop();
    }
  }

  function wireEvents() {
    el.textInput.addEventListener('input', function () {
      if (isShowingDemo) {
        isShowingDemo = false;
        el.textHint.hidden = true;
      }
      onTextOrModeChange();
    });

    el.phraseModeSelect.addEventListener('change', onTextOrModeChange);

    var liveControls = [
      [el.fontFamilySelect, 'change'],
      [el.fontSizeRange, 'input'],
      [el.alignSelect, 'change'],
      [el.textColorInput, 'input'],
      [el.bgColorInput, 'input'],
      [el.cursorColorInput, 'input'],
      [el.typingSpeedRange, 'input'],
      [el.deletingSpeedRange, 'input'],
      [el.pauseTypedRange, 'input'],
      [el.pauseDeletedRange, 'input'],
      [el.jitterCheckbox, 'change'],
      [el.punctuationPauseCheckbox, 'change'],
      [el.loopCheckbox, 'change'],
      [el.cursorCustomInput, 'input'],
      [el.cursorBlinkCheckbox, 'change'],
      [el.blinkSpeedRange, 'input']
    ];
    liveControls.forEach(function (pair) {
      pair[0].addEventListener(pair[1], onLiveControlChange);
    });

    el.cursorCharSelect.addEventListener('change', function () {
      el.cursorCustomField.hidden = el.cursorCharSelect.value !== 'custom';
      onLiveControlChange();
    });

    el.instantModeCheckbox.addEventListener('change', function () {
      hardReset();
      scheduleSave();
      if (el.instantModeCheckbox.checked) {
        renderInstantAndStop();
      } else {
        refreshUI();
        updateStatus(getPhrases().length ? 'Ready' : 'Enter some text to see the typewriter effect.');
      }
    });

    Array.prototype.forEach.call(document.querySelectorAll('.chip[data-theme]'), function (btn) {
      btn.addEventListener('click', function () {
        var theme = THEMES[btn.getAttribute('data-theme')];
        if (!theme) return;
        el.fontFamilySelect.value = theme.fontFamily;
        el.textColorInput.value = theme.textColor;
        el.bgColorInput.value = theme.bgColor;
        el.cursorColorInput.value = theme.cursorColor;
        onLiveControlChange();
      });
    });

    el.playBtn.addEventListener('click', startPlayback);
    el.pauseBtn.addEventListener('click', pausePlayback);
    el.restartBtn.addEventListener('click', restartPlayback);

    el.generateExportBtn.addEventListener('click', function () {
      el.exportOutput.value = buildEmbedCode();
    });
    el.downloadExportBtn.addEventListener('click', downloadExportFile);
    el.copyExportBtn.addEventListener('click', copyExportOutput);

    el.resetDefaultsBtn.addEventListener('click', function () {
      window.clearTimeout(tickHandle);
      tickHandle = null;
      try { window.localStorage.removeItem(STORAGE_KEY); } catch (e) { /* ignore */ }
      var fresh = JSON.parse(JSON.stringify(DEFAULTS));
      isShowingDemo = true;
      el.textInput.value = DEFAULT_DEMO_TEXT;
      el.textHint.hidden = false;
      applySettingsToControls(fresh);
      applyPreviewStyle(fresh);
      applyCursorChar(fresh);
      hardReset();
      startPlayback();
    });
  }

  /* ---------------------------------------------------------------------
     Init
     ------------------------------------------------------------------- */
  function init() {
    el.phraseModeSelect = grab('phraseModeSelect');
    el.textInput = grab('textInput');
    el.textHint = grab('textHint');
    el.fontFamilySelect = grab('fontFamilySelect');
    el.fontSizeRange = grab('fontSizeRange');
    el.fontSizeValue = grab('fontSizeValue');
    el.alignSelect = grab('alignSelect');
    el.textColorInput = grab('textColorInput');
    el.bgColorInput = grab('bgColorInput');
    el.cursorColorInput = grab('cursorColorInput');
    el.typingSpeedRange = grab('typingSpeedRange');
    el.typingSpeedValue = grab('typingSpeedValue');
    el.deletingSpeedRange = grab('deletingSpeedRange');
    el.deletingSpeedValue = grab('deletingSpeedValue');
    el.pauseTypedRange = grab('pauseTypedRange');
    el.pauseTypedValue = grab('pauseTypedValue');
    el.pauseDeletedRange = grab('pauseDeletedRange');
    el.pauseDeletedValue = grab('pauseDeletedValue');
    el.jitterCheckbox = grab('jitterCheckbox');
    el.punctuationPauseCheckbox = grab('punctuationPauseCheckbox');
    el.loopCheckbox = grab('loopCheckbox');
    el.cursorCharSelect = grab('cursorCharSelect');
    el.cursorCustomField = grab('cursorCustomField');
    el.cursorCustomInput = grab('cursorCustomInput');
    el.cursorBlinkCheckbox = grab('cursorBlinkCheckbox');
    el.blinkSpeedRange = grab('blinkSpeedRange');
    el.blinkSpeedValue = grab('blinkSpeedValue');
    el.instantModeCheckbox = grab('instantModeCheckbox');
    el.reducedMotionNote = grab('reducedMotionNote');
    el.resetDefaultsBtn = grab('resetDefaultsBtn');
    el.statusText = grab('statusText');
    el.previewStage = grab('previewStage');
    el.previewText = grab('previewText');
    el.previewCursor = grab('previewCursor');
    el.srFullText = grab('srFullText');
    el.playBtn = grab('playBtn');
    el.pauseBtn = grab('pauseBtn');
    el.restartBtn = grab('restartBtn');
    el.generateExportBtn = grab('generateExportBtn');
    el.downloadExportBtn = grab('downloadExportBtn');
    el.exportOutput = grab('exportOutput');
    el.copyExportBtn = grab('copyExportBtn');
    el.copyStatus = grab('copyStatus');
    el.saveIndicator = grab('saveIndicator');

    storageAvailable = testStorageAvailable();
    var settings = loadSettings();

    if (settings.hasCustomText) {
      isShowingDemo = false;
      el.textInput.value = settings.text;
      el.textHint.hidden = true;
    } else {
      isShowingDemo = true;
      el.textInput.value = DEFAULT_DEMO_TEXT;
      el.textHint.hidden = false;
    }

    if (!hadSavedSettings && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      settings.instantMode = true;
      el.reducedMotionNote.hidden = false;
    }

    applySettingsToControls(settings);
    applyPreviewStyle(settings);
    applyCursorChar(settings);
    refreshUI();
    wireEvents();

    if (!storageAvailable) {
      el.saveIndicator.textContent = "Your browser is blocking local storage, so settings won't be remembered next visit.";
    }

    if (el.instantModeCheckbox.checked) {
      renderInstantAndStop();
    } else if (getPhrases().length > 0) {
      startPlayback();
    } else {
      updateStatus('Enter some text to see the typewriter effect.');
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
