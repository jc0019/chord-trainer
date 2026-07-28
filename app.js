// ======================== CONSTANTS ========================
const LETTERS = ['C','D','E','F','G','A','B'];
const LETTER_PC = {C:0,D:2,E:4,F:5,G:7,A:9,B:11}; // pitch class of each natural note
const MAJOR_IV = [0,2,4,5,7,9,11]; // major scale interval template, used as reference for Roman numeral prefixes (♭/♯)
const ROMAN = ['I','II','III','IV','V','VI','VII'];

// Scale interval patterns: semitone distances from root.
// e.g. Dorian [0,2,3,5,7,9,10] = W H W W W H W
const SCALES = {
  'Major (Ionian)':       [0,2,4,5,7,9,11],
  'Dorian':               [0,2,3,5,7,9,10],
  'Mixolydian':           [0,2,4,5,7,9,10],
  'Lydian':               [0,2,4,6,7,9,11],
  'Harmonic Minor':       [0,2,3,5,7,8,11],
  'Melodic Minor':        [0,2,3,5,7,9,11]
};

const ROOTS = ['C','Db','D','Eb','E','F','F#','Gb','G','Ab','A','Bb','B'];

// ======================== MUSIC THEORY ========================

/**
 * Convert a note name (e.g. "Eb", "F#", "Bbb") to its pitch class (0-11).
 * Each '#' adds 1 semitone, each 'b' subtracts 1 from the natural letter's pitch class.
 */
function noteToPc(name) {
  let pc = LETTER_PC[name[0]];
  for (let i = 1; i < name.length; i++) pc += (name[i] === '#' ? 1 : -1);
  return ((pc % 12) + 12) % 12;
}

/**
 * Given a target pitch class and a letter name, compute the accidental needed.
 * Key insight: diff = (targetPc - letterPc) mod 12 gives the raw offset.
 * If diff > 6 we interpret it as negative (e.g. diff=11 means -1 = one flat),
 * because the shortest path around the pitch class circle is always ≤ 6 semitones.
 * This ensures we never generate triple-sharps or triple-flats for standard scales.
 *
 * Example: pcToNoteName(3, 'E') → E has pc=4, target=3, diff=11→-1 → "Eb"
 */
function pcToNoteName(pc, letter) {
  const letterPc = LETTER_PC[letter];
  let diff = ((pc - letterPc) % 12 + 12) % 12;
  if (diff > 6) diff -= 12; // prefer flats over extreme sharps (and vice versa)
  if (diff > 0) return letter + '#'.repeat(diff);
  if (diff < 0) return letter + 'b'.repeat(-diff);
  return letter;
}

/**
 * Build correct enharmonic note names for any scale.
 * Strategy: assign consecutive letter names starting from the root's letter,
 * then compute the accidental for each to hit the target pitch class.
 * This guarantees each letter name (A-G) appears exactly once — the fundamental
 * rule of proper scale spelling.
 *
 * Example: getScaleNotes('Eb', [0,2,4,5,7,9,11])
 *   root letter = E, so letters cycle: E F G A B C D
 *   target PCs from Eb(3): 3,5,7,8,10,0,2
 *   → Eb, F, G, Ab, Bb, C, D ✓
 */
function getScaleNotes(rootName, intervals) {
  const rootPc = noteToPc(rootName);
  const rootIdx = LETTERS.indexOf(rootName[0]);
  return intervals.map((iv, i) => {
    const targetPc = (rootPc + iv) % 12;
    const letter = LETTERS[(rootIdx + i) % 7]; // consecutive letter for this degree
    return pcToNoteName(targetPc, letter);
  });
}

/** Return array of pitch classes (0-11) for each scale degree. */
function getScalePcs(rootName, intervals) {
  const rootPc = noteToPc(rootName);
  return intervals.map(iv => (rootPc + iv) % 12);
}

/**
 * Determine if a Roman numeral needs a ♭ or ♯ prefix.
 * Compares this scale degree's interval from the tonic against the major scale.
 * E.g. Dorian degree 2 has interval 3 (minor 3rd), major has 4 (major 3rd),
 * diff = 3-4 = -1 → mod 12 = 11 → prefix "♭" → "♭III"
 */
function getDegreePrefix(scaleIntervals, degree) {
  const diff = ((scaleIntervals[degree] - MAJOR_IV[degree]) % 12 + 12) % 12;
  if (diff === 0) return '';
  if (diff === 11) return '\u266d';  // -1 semitone → flat
  if (diff === 1) return '\u266f';   // +1 semitone → sharp
  if (diff === 10) return '\u266d\u266d'; // -2 semitones → double flat (rare)
  return '';
}

/**
 * Classify a chord by its interval structure and return Roman numeral formatting info.
 *
 * @param {number[]} intervals - Semitone distances from chord root, in stacking order.
 *   Triad: [0, third, fifth]        e.g. [0,4,7] = major
 *   7th:   [0, third, fifth, seventh] e.g. [0,3,7,10] = minor 7th
 *
 * @returns {Object} { romanCase, suffix, chordSymbol }
 *   romanCase: 'upper' for major/dominant/augmented, 'lower' for minor/diminished
 *   suffix:    appended to Roman numeral (e.g. "maj7", "°", "ø7")
 *   chordSymbol: appended to root note name for display (e.g. "m7", "dim", "aug(Maj7)")
 */
function getChordQuality(intervals, chordType) {
  const third = intervals[1]; // 3 = minor 3rd, 4 = major 3rd
  const fifth = intervals[2]; // 6 = diminished 5th, 7 = perfect 5th, 8 = augmented 5th
  let triadType, romanCase;

  // ---- Step 1: Classify triad quality from 3rd + 5th intervals ----
  if (third === 4 && fifth === 7)      { triadType = 'major';     romanCase = 'upper'; }
  else if (third === 3 && fifth === 7) { triadType = 'minor';     romanCase = 'lower'; }
  else if (third === 3 && fifth === 6) { triadType = 'diminished';romanCase = 'lower'; }
  else if (third === 4 && fifth === 8) { triadType = 'augmented'; romanCase = 'upper'; }
  else { triadType = 'other'; romanCase = 'lower'; }

  if (chordType === 'triad') {
    const suf = triadType === 'diminished' ? '\u00b0' : triadType === 'augmented' ? '\u207a' : '';
    const sym = triadType === 'minor' ? 'm' : triadType === 'diminished' ? 'dim' : triadType === 'augmented' ? 'aug' : '';
    return { romanCase, suffix: suf, chordSymbol: sym };
  }

  // ---- Step 2: Classify 7th chord from triad type + 7th interval ----
  // 9 = diminished 7th, 10 = minor 7th, 11 = major 7th
  const seventh = intervals[3];
  let suf7, sym7;
  if (triadType === 'major' && seventh === 11)       { suf7 = 'maj7'; sym7 = 'Maj7'; }       // Imaj7, IVmaj7
  else if (triadType === 'major' && seventh === 10)   { suf7 = '7';    sym7 = '7'; }           // V7 (dominant)
  else if (triadType === 'minor' && seventh === 10)   { suf7 = '7';    sym7 = 'm7'; }          // ii7, iii7, vi7
  else if (triadType === 'minor' && seventh === 11)   { suf7 = 'maj7'; sym7 = 'm(Maj7)'; }     // i(maj7) in harm/mel minor
  else if (triadType === 'diminished' && seventh===10){ suf7 = '\u00f87'; sym7 = '\u00f87'; }   // viiø7 (half-diminished)
  else if (triadType === 'diminished' && seventh===9) { suf7 = '\u00b07'; sym7 = '\u00b07'; }   // vii°7 (fully diminished, harm minor)
  else if (triadType === 'augmented' && seventh===11) { suf7 = '\u207amaj7'; sym7 = 'aug(Maj7)'; } // ♭III⁺maj7 in mel minor
  else if (triadType === 'augmented' && seventh===10) { suf7 = '\u207a7'; sym7 = 'aug7'; }     // rare: augmented dominant
  else { suf7 = '('+seventh+')'; sym7 = '('+seventh+')'; }

  return { romanCase, suffix: suf7, chordSymbol: sym7 };
}

/**
 * Convert internal note name (e.g. "Eb", "F##") to display string with Unicode symbols.
 * Only replaces accidentals AFTER the first character to avoid turning 'B' into '♭'.
 */
function displayNote(name) {
  return name[0] + name.slice(1).replace(/#/g,'\u266f').replace(/b/g,'\u266d');
}

// ======================== RANDOM DISTRIBUTION PROFILES ========================
/**
 * Degree-weight profiles for Random mode. For each profile, weights are looked
 * up by scale name; each entry is 7 relative weights for degrees 1-7.
 * A missing scale (or weights:null) falls back to uniform random.
 *
 * 'jazz' rationale: in jazz corpora the ii-V-I schema dominates, so ii/V/I get
 * roughly equal top weight; vii is rare as an independent chord. The minor
 * scales mirror this via the iiø-V-i schema. Modal scales (Dorian etc.) have
 * no defensible per-degree statistics, so they intentionally stay uniform.
 * Add new profiles here — the dropdown is populated from this object.
 */
const DIST_PROFILES = {
  jazz: {
    label: 'Jazz-weighted (ii‑V‑I heavy)',
    weights: {
      'Major (Ionian)': [22, 20, 7, 12, 22, 12, 5],
      'Harmonic Minor': [24, 20, 5, 12, 24, 10, 5],
      'Melodic Minor':  [24, 16, 6, 14, 20, 10, 10],
    }
  },
  uniform: { label: 'Equal (1–7 alike)', weights: null },
};

/** Weighted sample from parallel arrays of items and weights. */
function weightedPick(items, weights) {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i];
    if (r < 0) return items[i];
  }
  return items[items.length - 1];
}

// ======================== STATE ========================
const KEY_CIRCLE_4THS = ['C','F','Bb','Eb','Ab','Db','Gb','B','E','A','D','G'];
const PROG_251 = [1, 4, 0];
const SECONDARY_TARGETS = [0, 1, 2, 3, 4, 5];

const S = {
  heldMidiNotes: new Set(),   // raw MIDI note numbers currently held
  heldPcs:       new Set(),   // pitch classes (mod 12) of held notes
  currentQ:      null,        // current question object
  pendingQ:      null,        // next question queued after correct answer
  practiceCount: 0,
  lastDegree:    -1,
  showingAnswer: false,
  mode:          'random',    // 'random' | 'sequential' | '251' | '251-all' | 'secondary'
  modeIndex:     0,           // position in sequential or progression sequence
  keyCircleIdx:  0,           // position in KEY_CIRCLE_4THS
  checkTimer:    null,        // debounce timer for checkAnswer
  voicingHL:     true,        // voicing guide highlight on/off
  scaleRefHL:    true,        // scale reference highlight on/off
  cachedVoicings: [],         // voicing data for current question
  soundFB:       true,        // sound feedback (chime/buzz) on/off
  flashFB:       true,        // screen flash feedback on/off
  wrongActive:   false,       // currently holding a "wrong" set (prevents repeat triggers)
  graceUntilEmpty: false,     // suppress wrong-detection until all keys released (stage/question switch)
  cofKeyNames:   [],          // per-CoF-position display spelling (context respelling)
  distMode:      'jazz',      // key into DIST_PROFILES (degree / secondary-target distribution)
  uiContent:     'degrees',   // Practice content: 'degrees' | '251' | 'secondary'
  uiOrder:       'random',    // Degrees sub-choice: 'random' | 'sequential' (remembered across switches)
  uiKeys:        'one',       // ii-V-I sub-choice: 'one' | 'all' (remembered across switches)
};

// ======================== FEEDBACK (sound + screen flash) ========================
let _audioCtx = null;

/** Lazily create (and resume) the shared AudioContext (Web Audio API).
 *  Browsers require a user gesture before audio can play — see initFeedbackToggles. */
function getAudioCtx() {
  if (!_audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    _audioCtx = new AC();
  }
  if (_audioCtx.state === 'suspended') _audioCtx.resume();
  return _audioCtx;
}

/** Schedule one tone routed through a low-pass filter (BiquadFilterNode)
 *  for a warm, muted timbre — soft attack, long exponential decay. */
function playTone(freq, startDelay, dur, type, peak, cutoff) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const t0 = ctx.currentTime + startDelay;
  const osc = ctx.createOscillator();
  const filt = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  if (ctx.state !== 'running') return; // not unlocked yet — skip rather than queue a burst
  osc.type = type;
  osc.frequency.value = freq;
  filt.type = 'lowpass';
  filt.frequency.setValueAtTime(cutoff || 1100, t0);
  filt.frequency.exponentialRampToValueAtTime(Math.max(300, (cutoff || 1100) * 0.4), t0 + dur); // darken as it decays
  filt.Q.value = 0.5;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(peak, t0 + 0.025);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(filt);
  filt.connect(gain);
  gain.connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.05);
}

/** Warm two-note chime (E5 → A5), marimba-like: filtered triangle
 *  with a quiet sine an octave below for body. */
function playCorrectSound() {
  playTone(659.3, 0,    0.38, 'triangle', 0.11, 1000); // E5
  playTone(329.6, 0,    0.38, 'sine',     0.05, 800);  // E4 underlay
  playTone(880,   0.11, 0.5,  'triangle', 0.10, 900);  // A5
  playTone(440,   0.11, 0.5,  'sine',     0.05, 800);  // A4 underlay
}

/** Muted low thud for a wrong note — filtered, no harsh buzz. */
function playWrongSound() {
  playTone(130.8, 0, 0.28, 'triangle', 0.16, 450); // C3
  playTone(98,    0, 0.32, 'sine',     0.12, 350); // G2 underlay
}

/** Full-screen flash: color is 'green' or 'red'. */
function flashScreen(color) {
  const el = document.getElementById('flash-overlay');
  el.classList.remove('flash', 'green', 'red');
  void el.offsetWidth; // force reflow so the CSS animation can restart
  el.classList.add('flash', color);
}

function feedbackCorrect() {
  if (S.soundFB) playCorrectSound();
  if (S.flashFB) flashScreen('green');
}

function feedbackWrong() {
  if (S.soundFB) playWrongSound();
  if (S.flashFB) flashScreen('red');
}

function saveFeedbackPrefs() {
  try {
    localStorage.setItem('ct-feedback', JSON.stringify({ sound: S.soundFB, flash: S.flashFB }));
  } catch (e) { /* private mode etc. — non-fatal */ }
}

function initFeedbackToggles() {
  try {
    const saved = JSON.parse(localStorage.getItem('ct-feedback') || '{}');
    if (typeof saved.sound === 'boolean') S.soundFB = saved.sound;
    if (typeof saved.flash === 'boolean') S.flashFB = saved.flash;
  } catch (e) { /* ignore corrupt prefs */ }

  const st = document.getElementById('sound-toggle');
  const ft = document.getElementById('flash-toggle');
  st.classList.toggle('on', S.soundFB);
  ft.classList.toggle('on', S.flashFB);

  st.addEventListener('click', () => {
    S.soundFB = !S.soundFB;
    st.classList.toggle('on', S.soundFB);
    saveFeedbackPrefs();
    if (S.soundFB) playCorrectSound(); // preview — also unlocks the AudioContext
  });
  ft.addEventListener('click', () => {
    S.flashFB = !S.flashFB;
    ft.classList.toggle('on', S.flashFB);
    saveFeedbackPrefs();
    if (S.flashFB) flashScreen('green'); // preview
  });

  // Unlock audio on the first user gesture anywhere on the page,
  // so the chime works even if the user only ever plays MIDI keys afterwards.
  const unlock = () => { getAudioCtx(); };
  document.addEventListener('pointerdown', unlock, { once: true });
  document.addEventListener('keydown', unlock, { once: true });
}

// ======================== MIDI ========================
async function initMidi() {
  const statusEl = document.getElementById('midi-status');
  if (!navigator.requestMIDIAccess) {
    statusEl.textContent = 'Web MIDI not supported in this browser';
    statusEl.className = 'disconnected';
    return;
  }
  try {
    const access = await navigator.requestMIDIAccess();
    function bindInputs() {
      let names = [];
      for (const input of access.inputs.values()) {
        input.onmidimessage = handleMidiMessage;
        names.push(input.name);
      }
      if (names.length > 0) {
        statusEl.textContent = '\u25cf ' + names.join(', ');
        statusEl.className = 'connected';
      } else {
        statusEl.textContent = 'No MIDI device detected';
        statusEl.className = 'disconnected';
      }
    }
    bindInputs();
    access.onstatechange = () => bindInputs();
  } catch (err) {
    statusEl.textContent = 'MIDI error: ' + err.message;
    statusEl.className = 'disconnected';
  }
}

/**
 * Parse incoming MIDI messages.
 * MIDI status byte: high nibble = command, low nibble = channel.
 *   0x90 = Note On (velocity > 0), 0x80 = Note Off.
 *   Some keyboards send Note On with velocity=0 instead of Note Off.
 *
 * After updating held notes, we reduce to pitch classes (mod 12)
 * for chord matching — voicing/octave doesn't matter.
 */
function handleMidiMessage(msg) {
  const [status, note, velocity] = msg.data;
  const cmd = status & 0xf0; // mask off channel bits to get command
  if (cmd === 0x90 && velocity > 0) {
    S.heldMidiNotes.add(note);
  } else if (cmd === 0x80 || (cmd === 0x90 && velocity === 0)) {
    S.heldMidiNotes.delete(note);
  } else return;

  S.heldPcs = new Set([...S.heldMidiNotes].map(n => n % 12));

  updateHeldNotesDisplay();
  checkAnswer();

  // Advance to queued question when all keys released
  if (S.pendingQ && S.currentQ && S.currentQ.answered && S.heldMidiNotes.size === 0) {
    S.currentQ = S.pendingQ;
    S.pendingQ = buildQuestion(); // pre-build next so preview is always ready
    S.showingAnswer = false;
    renderQuestion();
  }
}

// ======================== QUIZ LOGIC ========================

/** Pick next scale degree based on current practice mode. Mutates S.modeIndex. */
function pickDegree() {
  const isCircleMode = S.mode === '251-all';
  if (S.mode === 'sequential') {
    const d = S.modeIndex % 7;
    S.modeIndex++;
    return d;
  }
  if (S.mode === '251' || isCircleMode) {
    const d = PROG_251[S.modeIndex % 3];
    S.modeIndex++;
    return d;
  }
  // Random: avoid immediate repeats, then sample by the active distribution
  const candidates = [0,1,2,3,4,5,6].filter(d => d !== S.lastDegree);
  const profile = DIST_PROFILES[S.distMode];
  const table = profile && profile.weights;
  const w = table && table[document.getElementById('scale-select').value];
  if (!w) return candidates[Math.floor(Math.random() * candidates.length)]; // uniform fallback
  return weightedPick(candidates, candidates.map(d => w[d]));
}

/**
 * Build all valid pitch-class sets a player can use to answer.
 * Generated combinatorially from chord tones + extensions (9th, 13th).
 *
 * 9th/13th voicings include the root; pure rootless shapes are not accepted
 * as complete answers.
 */
function buildValidSets(chordPcs, chordType, scalePcs, degree, intervalsFromRoot) {
  const sets = [new Set(chordPcs)]; // full chord is always valid
  if (chordType !== '7th') return sets;

  const rootPc = chordPcs[0], thirdPc = chordPcs[1],
        fifthPc = chordPcs[2], seventhPc = chordPcs[3];
  const ninthPc = scalePcs[(degree + 1) % 7];

  sets.push(new Set([rootPc, thirdPc, seventhPc]));          // Drop 5
  sets.push(new Set([rootPc, thirdPc, fifthPc, seventhPc, ninthPc])); // 9th
  sets.push(new Set([rootPc, thirdPc, seventhPc, ninthPc]));          // 9th drop 5

  // Dominant: also accept 13th in place of 5th
  const isDom = intervalsFromRoot[1] === 4 && intervalsFromRoot[3] === 10;
  if (isDom) {
    const thirteenthPc = scalePcs[(degree + 5) % 7];
    sets.push(new Set([rootPc, thirdPc, thirteenthPc, seventhPc, ninthPc])); // 13th
    sets.push(new Set([rootPc, thirteenthPc, seventhPc, ninthPc]));          // 13th drop 3
  }

  return sets;
}

function buildLimitedSeventhSets(chordPcs, includeShell) {
  const rootPc = chordPcs[0], thirdPc = chordPcs[1], seventhPc = chordPcs[3];
  const sets = [
    new Set(chordPcs),                    // Full 7th
    new Set([rootPc, thirdPc, seventhPc]) // Drop 5
  ];
  if (includeShell) sets.push(new Set([thirdPc, seventhPc]));
  return sets;
}

function chordFromRootIntervals(rootName, intervals) {
  const rootPc = noteToPc(rootName);
  const rootIdx = LETTERS.indexOf(rootName[0]);
  return intervals.map((iv, i) => {
    const targetPc = (rootPc + iv) % 12;
    const letter = LETTERS[(rootIdx + i * 2) % 7];
    return pcToNoteName(targetPc, letter);
  });
}

function makeSeventhChordQ(rootName, chordNotes, chordPcs, validSets) {
  const intervalsFromRoot = chordPcs.map(pc => ((pc - chordPcs[0]) % 12 + 12) % 12);
  return {
    rootName,
    chordType: '7th',
    chordNotes,
    chordPcs,
    intervalsFromRoot,
    quality: getChordQuality(intervalsFromRoot, '7th'),
    validSets
  };
}

function secondaryVoicings(q, includeShell) {
  const n = q.chordNotes;
  const ivs = q.intervalsFromRoot;
  const voicings = [
    { label: 'Full', raw: [n[0], n[1], n[2], n[3]], funcs: ['R', ivToFunc(ivs[1]), ivToFunc(ivs[2]), ivToFunc(ivs[3])] },
    { label: 'Drop 5', raw: [n[0], n[1], n[3]], funcs: ['R', ivToFunc(ivs[1]), ivToFunc(ivs[3])] },
  ];
  if (includeShell) voicings.push({ label: 'Shell', raw: [n[1], n[3]], funcs: [ivToFunc(ivs[1]), ivToFunc(ivs[3])] });
  return voicings;
}

function activeSecondaryChord(q) {
  return q.secondaryStage === 'target' ? q.targetQ : q.dominantQ;
}

/**
 * Pick which degree gets tonicized in Secondary V mode.
 * Reuses the active distribution profile's Major weights, renormalized over
 * the allowed targets (I–vi): chords that appear more often also get
 * tonicized more often (first-order approximation).
 */
function pickSecondaryTargetDegree() {
  const candidates = SECONDARY_TARGETS.filter(d => d !== S.lastDegree);
  const profile = DIST_PROFILES[S.distMode];
  const table = profile && profile.weights;
  const w = table && table['Major (Ionian)']; // Secondary V always runs in Major
  const degree = w
    ? weightedPick(candidates, candidates.map(d => w[d]))
    : candidates[Math.floor(Math.random() * candidates.length)];
  S.lastDegree = degree;
  return degree;
}

function buildSecondaryQuestion() {
  const rootName = document.getElementById('key-select').value;
  const scaleName = 'Major (Ionian)';
  const scaleIv = SCALES[scaleName];
  const scaleNotes = getScaleNotes(rootName, scaleIv);
  const scalePcs = getScalePcs(rootName, scaleIv);
  const targetDegree = pickSecondaryTargetDegree();
  const stackIdx = [0, 2, 4, 6];

  const targetNotes = stackIdx.map(i => scaleNotes[(targetDegree + i) % 7]);
  const targetPcs = stackIdx.map(i => scalePcs[(targetDegree + i) % 7]);
  const targetQ = makeSeventhChordQ(
    targetNotes[0],
    targetNotes,
    targetPcs,
    buildLimitedSeventhSets(targetPcs, false)
  );

  const dominantRootPc = (targetPcs[0] + 7) % 12;
  const dominantRootLetter = LETTERS[(LETTERS.indexOf(targetNotes[0][0]) + 4) % 7];
  const dominantRoot = pcToNoteName(dominantRootPc, dominantRootLetter);
  const dominantNotes = chordFromRootIntervals(dominantRoot, [0, 4, 7, 10]);
  const dominantPcs = dominantNotes.map(noteToPc);
  const dominantQ = makeSeventhChordQ(
    dominantRoot,
    dominantNotes,
    dominantPcs,
    buildLimitedSeventhSets(dominantPcs, true)
  );

  const targetQuality = targetQ.quality;
  const targetBase = ROMAN[targetDegree];
  const targetRoman = targetQuality.romanCase === 'upper' ? targetBase : targetBase.toLowerCase();

  return {
    secondary: true,
    secondaryStage: 'dominant',
    rootName, scaleName, chordType: '7th', degree: targetDegree,
    scaleNotes, scalePcs, scaleIv,
    dominantQ, targetQ,
    chordNotes: dominantNotes,
    chordPcs: dominantPcs,
    intervalsFromRoot: dominantQ.intervalsFromRoot,
    quality: dominantQ.quality,
    prefix: 'V/',
    romanCased: targetRoman,
    targetRoman,
    validSets: dominantQ.validSets,
    answered: false
  };
}

function buildQuestion() {
  if (S.mode === 'secondary') return buildSecondaryQuestion();

  // In circle modes, advance key at the start of each new ii-V-I cycle
  if (S.mode === '251-all' && S.modeIndex > 0 && S.modeIndex % 3 === 0) {
    S.keyCircleIdx = (S.keyCircleIdx + 1) % 12;
  }

  const rootName = S.mode === '251-all'
    ? KEY_CIRCLE_4THS[S.keyCircleIdx]
    : document.getElementById('key-select').value;
  const scaleName = document.getElementById('scale-select').value;
  const chordType = getChordType();
  const scaleIv = SCALES[scaleName];
  const scaleNotes = getScaleNotes(rootName, scaleIv);
  const scalePcs = getScalePcs(rootName, scaleIv);

  const degree = pickDegree();
  S.lastDegree = degree;

  // Build chord by stacking diatonic 3rds
  const stackIdx = chordType === '7th' ? [0, 2, 4, 6] : [0, 2, 4];
  const chordNotes = stackIdx.map(i => scaleNotes[(degree + i) % 7]);
  const chordPcs = stackIdx.map(i => scalePcs[(degree + i) % 7]);

  const rootPc = chordPcs[0];
  const intervalsFromRoot = chordPcs.map(pc => ((pc - rootPc) % 12 + 12) % 12);

  const quality = getChordQuality(intervalsFromRoot, chordType);
  const prefix = getDegreePrefix(scaleIv, degree);
  const romanBase = ROMAN[degree];
  const romanCased = quality.romanCase === 'upper' ? romanBase : romanBase.toLowerCase();
  const validSets = buildValidSets(chordPcs, chordType, scalePcs, degree, intervalsFromRoot);

  return {
    rootName, scaleName, chordType, degree,
    scaleNotes, scalePcs, scaleIv,
    chordNotes, chordPcs, intervalsFromRoot,
    quality, prefix, romanCased,
    validSets, answered: false
  };
}

function nextQuestion() {
  S.showingAnswer = false;
  if (S.pendingQ) {
    S.currentQ = S.pendingQ;
  } else {
    S.currentQ = buildQuestion();
  }
  // Always pre-build the next question so preview is visible immediately
  S.pendingQ = buildQuestion();
  renderQuestion();
}

/**
 * On every MIDI note-on / note-off, check if currently held pitch classes
 * exactly match any valid target set.
 * - Exact match → correct (extra notes = no trigger, wrong notes = no penalty)
 * - The user can hold extra notes; releasing them to reach exact match triggers success
 */
function checkAnswer() {
  if (!S.currentQ || S.currentQ.answered) return;
  // Debounce: wait for nearly-simultaneous key presses to all arrive
  if (S.checkTimer) clearTimeout(S.checkTimer);
  S.checkTimer = setTimeout(() => {
    S.checkTimer = null;
    if (!S.currentQ || S.currentQ.answered) return;
    for (const validSet of S.currentQ.validSets) {
      if (setsEqual(S.heldPcs, validSet)) {
        S.wrongActive = false;
        if (S.currentQ.secondary && S.currentQ.secondaryStage === 'dominant') {
          feedbackCorrect();
          // The player is still holding the dominant chord, whose notes are not
          // part of the target chord — don't judge "wrong" while they let go.
          S.graceUntilEmpty = true;
          S.currentQ.secondaryStage = 'target';
          const targetQ = S.currentQ.targetQ;
          S.currentQ.chordNotes = targetQ.chordNotes;
          S.currentQ.chordPcs = targetQ.chordPcs;
          S.currentQ.intervalsFromRoot = targetQ.intervalsFromRoot;
          S.currentQ.quality = targetQ.quality;
          S.currentQ.validSets = targetQ.validSets;
          document.getElementById('roman-numeral').innerHTML =
            '<span class="rn-prefix">\u2192</span>' +
            '<span class="rn-numeral">' + S.currentQ.targetRoman + '</span>';
          renderVoicingGuide();
          return;
        }
        S.currentQ.answered = true;
        S.practiceCount++;
        feedbackCorrect();
        document.getElementById('score').textContent = 'Practiced: ' + S.practiceCount;
        document.getElementById('roman-numeral').classList.add('correct');
        // pendingQ is already pre-built; no need to rebuild or update preview
        return;
      }
    }
    // Grace period: after a stage/question switch with keys still held,
    // leftover notes from the previous chord must not count as "wrong".
    // Lifts once the hand fully clears.
    if (S.graceUntilEmpty) {
      if (S.heldPcs.size === 0) S.graceUntilEmpty = false;
      return;
    }
    // No exact match — judge "wrong" as soon as any held note falls outside
    // EVERY valid answer, i.e. the held notes are no longer a partial build
    // of any valid set. Fires once per offence; resets when the hand returns
    // to a buildable subset (or all keys are released).
    const partialOfSome = S.currentQ.validSets.some(vs => {
      for (const pc of S.heldPcs) if (!vs.has(pc)) return false;
      return true;
    });
    if (S.heldPcs.size > 0 && !partialOfSome) {
      if (!S.wrongActive) { S.wrongActive = true; feedbackWrong(); }
    } else {
      S.wrongActive = false;
    }
  }, 40);
}

/** Set equality: same size and every element of a is in b. */
function setsEqual(a, b) {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

function showAnswer() {
  if (!S.currentQ) return;
  S.showingAnswer = true;
  const q = S.currentQ;
  if (q.secondary) {
    const dom = q.dominantQ;
    const target = q.targetQ;
    const domName = displayNote(dom.chordNotes[0]) + dom.quality.chordSymbol;
    const targetName = displayNote(target.chordNotes[0]) + target.quality.chordSymbol;
    const domNotes = dom.chordNotes.map(displayNote).join('  ');
    const targetNotes = target.chordNotes.map(displayNote).join('  ');
    document.getElementById('answer-display').innerHTML =
      '<strong>' + domName + ' \u2192 ' + targetName + '</strong> &nbsp; ( ' +
      domNotes + ' \u2192 ' + targetNotes + ' )';
    document.getElementById('answer-display').style.opacity = '1';
    renderVoicingGuide();
    return;
  }
  const chordName = displayNote(q.chordNotes[0]) + q.quality.chordSymbol;
  const noteNames = q.chordNotes.map(displayNote).join('  ');
  document.getElementById('answer-display').innerHTML =
    '<strong>' + chordName + '</strong> &nbsp; ( ' + noteNames + ' )';
  document.getElementById('answer-display').style.opacity = '1';

  renderVoicingGuide();
}

/**
 * Show the next question's roman numeral below the current one,
 * at low opacity to hint it's coming next. Clears on renderQuestion().
 */
function showPendingPreview() {
  const el = document.getElementById('next-preview');
  if (!S.pendingQ) { el.style.opacity = '0'; return; }
  const p = S.pendingQ;
  el.innerHTML = romanHTML(p);
  el.style.opacity = '0.18';
}


// ======================== UI ========================

/** Build Roman numeral HTML from a question object (or any {prefix, romanCased, quality}). */
function romanHTML(q) {
  if (q.secondary) {
    return '<span class="rn-numeral">V of ' + q.targetRoman + '</span>';
  }
  return '<span class="rn-prefix">' + q.prefix + '</span>' +
    '<span class="rn-numeral">' + q.romanCased + '</span>' +
    '<span class="rn-suffix">' + q.quality.suffix + '</span>';
}

function getChordType() {
  return document.querySelector('.type-btn.active').dataset.type;
}

function populateSelectors() {
  const keySel = document.getElementById('key-select');
  ROOTS.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r; opt.textContent = displayNote(r);
    keySel.appendChild(opt);
  });
  const scaleSel = document.getElementById('scale-select');
  Object.keys(SCALES).forEach(s => {
    const opt = document.createElement('option');
    opt.value = s; opt.textContent = s;
    scaleSel.appendChild(opt);
  });
  const distSel = document.getElementById('dist-select');
  Object.keys(DIST_PROFILES).forEach(k => {
    const opt = document.createElement('option');
    opt.value = k; opt.textContent = DIST_PROFILES[k].label;
    distSel.appendChild(opt);
  });
}

// ======================== THEME PICKER ========================
const THEMES = ['sage', 'lavender', 'sky']; // 'sage' = base palette, no data attribute

function applyTheme(name) {
  if (name === 'sage') delete document.body.dataset.theme;
  else document.body.dataset.theme = name;
  document.querySelectorAll('.theme-dot').forEach(d =>
    d.classList.toggle('active', d.dataset.theme === name));
}

function initThemePicker() {
  let theme = 'sage';
  try {
    const saved = localStorage.getItem('ct-theme');
    if (THEMES.includes(saved)) theme = saved;
  } catch (e) { /* ignore */ }
  applyTheme(theme);
  document.querySelectorAll('.theme-dot').forEach(d => {
    d.addEventListener('click', () => {
      applyTheme(d.dataset.theme);
      try { localStorage.setItem('ct-theme', d.dataset.theme); } catch (e) { /* ignore */ }
    });
  });
}

function initDistSelect() {
  const distSel = document.getElementById('dist-select');
  try {
    const saved = localStorage.getItem('ct-dist');
    if (saved && DIST_PROFILES[saved]) S.distMode = saved;
  } catch (e) { /* ignore */ }
  distSel.value = S.distMode;
  distSel.addEventListener('change', () => {
    S.distMode = distSel.value;
    try { localStorage.setItem('ct-dist', S.distMode); } catch (e) { /* ignore */ }
    // Current question stays; rebuild only the queued one under the new distribution
    S.pendingQ = buildQuestion();
    showPendingPreview();
  });
}

function renderQuestion() {
  const q = S.currentQ;
  document.getElementById('key-select').value = q.rootName;
  document.getElementById('scale-select').value = q.scaleName;
  document.getElementById('scale-label').textContent =
    displayNote(q.rootName) + ' ' + q.scaleName;

  const rnEl = document.getElementById('roman-numeral');
  rnEl.classList.remove('correct');
  rnEl.innerHTML = romanHTML(q);

  document.getElementById('answer-display').style.opacity = '0';
  document.getElementById('answer-display').innerHTML = '';
  showPendingPreview();
  document.getElementById('feedback').textContent = '';
  document.getElementById('feedback').className = '';
  S.showingAnswer = false;
  S.wrongActive = false;
  // A pending debounce from the previous question must not judge this one,
  // and notes still held from the previous chord get a grace period.
  if (S.checkTimer) { clearTimeout(S.checkTimer); S.checkTimer = null; }
  S.graceUntilEmpty = S.heldPcs.size > 0;

  renderVoicingGuide();
  updateCircleOfFifths();
  updateScaleRef();
  renderChordRef();
}

function updateHeldNotesDisplay() {
  const pcName = {};
  if (S.currentQ) {
    S.currentQ.scalePcs.forEach((pc, i) => { pcName[pc] = displayNote(S.currentQ.scaleNotes[i]); });
  }
  const useFl = S.currentQ && S.currentQ.rootName.length > 1 && S.currentQ.rootName[1] === 'b';
  const sharps = ['C','C\u266f','D','D\u266f','E','F','F\u266f','G','G\u266f','A','A\u266f','B'];
  const flats  = ['C','D\u266d','D','E\u266d','E','F','G\u266d','G','A\u266d','A','B\u266d','B'];
  const fallback = useFl ? flats : sharps;
  const notes = [...S.heldPcs].sort((a,b) => a-b).map(pc => pcName[pc] || fallback[pc]);
  document.getElementById('held-notes').textContent = notes.length ? notes.join('  ') : '';
}

// ======================== VOICING GUIDE ========================

/**
 * 9th voicing formulas built from common rootless A/B shapes plus root.
 *
 * Type A — built upward from the 3rd.  Type B — built upward from the 7th.
 * Stored as [scaleStepOffset, functionLabel] pairs.
 */
const VOICING_FORMULAS = {
  'Maj7':      { a: [[2,'3'],[4,'5'],[6,'7'],[8,'9']], b: [[6,'7'],[8,'9'],[2,'3'],[4,'5']] },
  'm7':        { a: [[2,'\u266d3'],[4,'5'],[6,'\u266d7'],[8,'9']], b: [[6,'\u266d7'],[8,'9'],[2,'\u266d3'],[4,'5']] },
  '7':         { a: [[2,'3'],[4,'5',true],[5,'13',true],[6,'\u266d7'],[8,'9']], b: [[6,'\u266d7'],[8,'9'],[2,'3'],[4,'5',true],[5,'13',true]] },
  'm(Maj7)':   { a: [[2,'\u266d3'],[4,'5'],[6,'7'],[8,'9']], b: [[6,'7'],[8,'9'],[2,'\u266d3'],[4,'5']] },
  '\u00f87':   { a: [[2,'\u266d3'],[4,'\u266d5'],[6,'\u266d7'],[8,'9']], b: [[6,'\u266d7'],[8,'9'],[2,'\u266d3'],[4,'\u266d5']] },
  '\u00b07':   { a: [[2,'\u266d3'],[4,'\u266d5'],[6,'\u266d\u266d7'],[8,'9']], b: [[6,'\u266d\u266d7'],[8,'9'],[2,'\u266d3'],[4,'\u266d5']] },
  'aug(Maj7)': { a: [[2,'3'],[4,'\u266f5'],[6,'7'],[8,'9']], b: [[6,'7'],[8,'9'],[2,'3'],[4,'\u266f5']] },
  'aug7':      { a: [[2,'3'],[4,'\u266f5'],[6,'\u266d7'],[8,'9']], b: [[6,'\u266d7'],[8,'9'],[2,'3'],[4,'\u266f5']] },
};

// ---- Mini Piano Constants ----
const MP = { ww: 24, wh: 88, bw: 17, bh: 56, step: 27, octs: 2, start: 48 };
const IS_WHITE = [1,0,1,0,1,1,0,1,0,1,0,1]; // C=1,C#=0,D=1,...

/** Compute white/black key layout for a piano starting at a given pitch class. */
function keyLayout(startPc) {
  const whites = [], blacks = [];
  let wIdx = 0;
  for (let off = 0; off < 12; off++) {
    if (IS_WHITE[(startPc + off) % 12]) {
      whites.push(off);
      wIdx++;
    } else {
      blacks.push({ off, after: wIdx - 1 });
    }
  }
  return { whites, blacks };
}

/** Convert an array of raw note names (bottom→top) into MIDI notes starting near C3. */
function notesToMidi(rawNotes) {
  const midi = [];
  let cur = MP.start;
  for (const n of rawNotes) {
    const pc = noteToPc(n);
    while (cur % 12 !== pc) cur++;
    midi.push(cur);
    cur++;
  }
  return midi;
}

/** Render a 2-octave mini piano into `container`, highlighting the given MIDI notes.
 *  If showHL is false, keys are drawn but not highlighted (no color, no labels). */
function renderMiniPiano(container, midiNotes, dispNames, funcLabels, showHL, altMidiNotes, opts) {
  if (showHL === undefined) showHL = true;
  const o = opts || {};
  const octs  = o.octs  || MP.octs;
  const start = o.start != null ? o.start : MP.start;
  const totalW = octs * 7 * MP.step;
  container.style.width = totalW + 'px';
  container.style.height = MP.wh + 'px';
  container.innerHTML = '';

  const hlSet = new Set(midiNotes);
  const altSet = new Set(altMidiNotes || []);
  const info = {};
  midiNotes.forEach((m, i) => { info[m] = { n: dispNames[i], f: funcLabels[i] }; });

  const layout = keyLayout(start % 12);

  // White keys
  for (let oct = 0; oct < octs; oct++) {
    layout.whites.forEach((off, i) => {
      const m = start + oct * 12 + off;
      const x = (oct * 7 + i) * MP.step;
      const hl = showHL && hlSet.has(m);
      const isAlt = hl && altSet.has(m);
      const k = document.createElement('div');
      k.className = 'mp-key w' + (hl ? ' hl' : '') + (isAlt ? ' alt' : '');
      k.style.cssText = 'left:' + x + 'px;top:0;width:' + MP.ww + 'px;height:' + MP.wh + 'px';
      container.appendChild(k);
      if (hl) addPianoLabels(container, x, MP.ww, info[m], isAlt, 'w');
    });
  }
  // Black keys
  for (let oct = 0; oct < octs; oct++) {
    layout.blacks.forEach(b => {
      const m = start + oct * 12 + b.off;
      const x = (oct * 7 + b.after) * MP.step + MP.step - MP.bw / 2;
      const hl = showHL && hlSet.has(m);
      const isAlt = hl && altSet.has(m);
      const k = document.createElement('div');
      k.className = 'mp-key b' + (hl ? ' hl' : '') + (isAlt ? ' alt' : '');
      k.style.cssText = 'left:' + x + 'px;top:0;width:' + MP.bw + 'px;height:' + MP.bh + 'px';
      container.appendChild(k);
      if (hl) addPianoLabels(container, x, MP.bw, info[m], isAlt, 'b');
    });
  }
}

function addPianoLabels(container, x, w, info, isAlt, keyType) {
  const altCls = isAlt ? ' alt' : '';
  const kCls = ' ' + keyType; // ' w' or ' b'
  // Position labels near bottom of each key
  const keyBottom = (keyType === 'w') ? MP.wh : MP.bh;
  const nnTop = keyBottom - 24;
  const fnTop = keyBottom - 12;
  // Note name (upper line)
  const nn = document.createElement('div');
  nn.className = 'mp-lbl nn' + kCls + altCls;
  nn.style.cssText = 'left:' + x + 'px;top:' + nnTop + 'px;width:' + w + 'px';
  nn.textContent = info.n;
  container.appendChild(nn);
  // Function label (lower line)
  const fn = document.createElement('div');
  fn.className = 'mp-lbl fn' + kCls + altCls;
  fn.style.cssText = 'left:' + x + 'px;top:' + fnTop + 'px;width:' + w + 'px';
  fn.textContent = info.f;
  container.appendChild(fn);
}

// ---- Interval → function label (quality-aware) ----
const IV_FUNC = { 0:'R', 3:'\u266d3', 4:'3', 6:'\u266d5', 7:'5', 8:'\u266f5', 9:'\u266d\u266d7', 10:'\u266d7', 11:'7' };
function ivToFunc(iv) { return IV_FUNC[iv] || '?'; }

function ninthChordLabel(chordSymbol) {
  if (chordSymbol === 'Maj7') return 'Maj9';
  if (chordSymbol === 'm7') return 'min9';
  if (chordSymbol === '7') return 'Dom9';
  if (chordSymbol === 'm(Maj7)') return 'min(Maj9)';
  if (chordSymbol === '\u00f87') return '\u00f89';
  if (chordSymbol === '\u00b07') return '\u00b09';
  if (chordSymbol === 'aug(Maj7)') return 'aug(Maj9)';
  if (chordSymbol === 'aug7') return 'aug(Dom9)';
  return chordSymbol + '(9)';
}

// ---- Build ALL voicing options for the current question ----
function getAllVoicings(q) {
  if (q.chordType === 'triad') {
    const n = q.chordNotes;
    return [
      { id: 'root', label: 'Root pos.', raw: [n[0],n[1],n[2]], funcs: ['R','3','5'] },
      { id: 'inv1', label: '1st inv.',  raw: [n[1],n[2],n[0]], funcs: ['3','5','R'] },
      { id: 'inv2', label: '2nd inv.',  raw: [n[2],n[0],n[1]], funcs: ['5','R','3'] },
    ];
  }

  // 7th chord — build function labels from intervals
  const ivs = q.intervalsFromRoot;
  const fR = 'R', f3 = ivToFunc(ivs[1]), f5 = ivToFunc(ivs[2]), f7 = ivToFunc(ivs[3]);
  const n = q.chordNotes; // [root, 3rd, 5th, 7th]

  const voicings = [
    { id: 'full',  label: 'Full',    raw: [n[0],n[1],n[2],n[3]], funcs: [fR,f3,f5,f7] },
    { id: 'drop5', label: 'Drop 5',  raw: [n[0],n[1],n[3]],      funcs: [fR,f3,f7] },
  ];

  // 9th voicings from A/B formulas, with root added below the upper structure.
  const sym = q.quality.chordSymbol;
  const formula = VOICING_FORMULAS[sym];
  if (formula) {
    function resolve(slots) {
      const raw = [q.scaleNotes[q.degree], ...slots.map(s => q.scaleNotes[(q.degree + s[0]) % 7])];
      const funcs = ['R', ...slots.map(s => s[1])];
      const altIdx = slots
        .map((s, i) => (s[2] ? i + 1 : -1))
        .filter(i => i >= 0);
      return { raw, funcs, altIdx };
    }
    const rA = resolve(formula.a), rB = resolve(formula.b);
    const label = ninthChordLabel(sym);
    voicings.push({ id: 'ninthA', label: label + ' A', ...rA });
    voicings.push({ id: 'ninthB', label: label + ' B', ...rB });
  }

  return voicings;
}

// Voicing guide uses S.voicingHL and S.S.cachedVoicings

// ---- Build one voicing column (label + mini piano) ----
function buildVoicingCol(label, rawNotes, funcLabels, altIdx) {
  const col = document.createElement('div');
  col.className = 'voicing-col';

  const lbl = document.createElement('div');
  lbl.className = 'voicing-label';
  lbl.textContent = label;
  col.appendChild(lbl);

  const piano = document.createElement('div');
  piano.className = 'mini-piano';
  const midi = notesToMidi(rawNotes);
  const disp = rawNotes.map(displayNote);
  const altMidi = (altIdx || []).map(i => midi[i]);

  // Default window is C3 + 2 octaves; if the voicing's top note overflows it
  // (e.g. rootless B-forms on high roots: Fm9 B reaches C5), slide the window
  // up to the lowest note's white key so every note stays visible.
  let start = MP.start;
  const hi = Math.max(...midi);
  if (hi >= MP.start + MP.octs * 12) {
    start = Math.min(...midi);
    while (!IS_WHITE[((start % 12) + 12) % 12]) start--; // anchor on a white key
  }

  renderMiniPiano(piano, midi, disp, funcLabels, S.voicingHL, altMidi, { start });
  col.appendChild(piano);

  return col;
}

function renderVoicingGuide() {
  const togEl = document.getElementById('voicing-toggles');
  const pianoEl = document.getElementById('voicing-pianos');
  togEl.innerHTML = '';
  pianoEl.innerHTML = '';
  if (!S.currentQ) return;

  if (S.currentQ.secondary) {
    const activeQ = activeSecondaryChord(S.currentQ);
    S.cachedVoicings = secondaryVoicings(activeQ, S.currentQ.secondaryStage === 'dominant');
  } else {
    S.cachedVoicings = getAllVoicings(S.currentQ);
  }

  // Highlight toggle (compact switch)
  const row = document.createElement('div');
  row.className = 'tog-row';
  const label = document.createElement('span');
  label.className = 'tog-label';
  label.textContent = 'Highlight';
  const tog = document.createElement('div');
  tog.className = 'tog' + (S.voicingHL ? ' on' : '');
  tog.addEventListener('click', () => {
    S.voicingHL = !S.voicingHL;
    tog.classList.toggle('on', S.voicingHL);
    renderVoicingPianos();
  });
  row.appendChild(label);
  row.appendChild(tog);
  togEl.appendChild(row);

  // Show all voicings
  renderVoicingPianos();
}

function renderVoicingPianos() {
  const pianoEl = document.getElementById('voicing-pianos');
  pianoEl.innerHTML = '';
  S.cachedVoicings.forEach(v => {
    pianoEl.appendChild(buildVoicingCol(v.label, v.raw, v.funcs, v.altIdx));
  });
}



// ======================== CIRCLE OF FIFTHS ========================
const COF_MAJOR = ['C','G','D','A','E','B','Gb','Db','Ab','Eb','Bb','F'];
const COF_MINOR = ['Am','Em','Bm','F♯m','C♯m','G♯m','E♭m','B♭m','Fm','Cm','Gm','Dm'];
const COF_CX = 180, COF_CY = 180;
const COF_GAP = 2.6 * Math.PI / 180; // half-gap between segments, per side
// Segmented-donut radii: outer band = major keys, inner band = relative minors,
// center hole shows the current key + scale.
const COF_R = {
  majOut: 150, majIn: 103,   // major band
  minOut: 97,  minIn: 69,    // minor band
  keyText: 126.5,            // major key label
  minText: 83,               // relative minor label
};

function cofPoint(r, a) {
  return [COF_CX + r * Math.cos(a), COF_CY + r * Math.sin(a)];
}

/** Annular (donut) segment path between radii r1<r2 from angle a1 to a2. */
function annularPath(r1, r2, a1, a2) {
  const [x1, y1] = cofPoint(r2, a1), [x2, y2] = cofPoint(r2, a2);
  const [x3, y3] = cofPoint(r1, a2), [x4, y4] = cofPoint(r1, a1);
  return 'M ' + x1 + ' ' + y1 + ' A ' + r2 + ' ' + r2 + ' 0 0 1 ' + x2 + ' ' + y2 +
    ' L ' + x3 + ' ' + y3 + ' A ' + r1 + ' ' + r1 + ' 0 0 0 ' + x4 + ' ' + y4 + ' Z';
}

function cofText(ns, svg, cls, cofIdx, x, y) {
  const t = document.createElementNS(ns, 'text');
  t.setAttribute('x', x);
  t.setAttribute('y', y);
  t.setAttribute('class', cls);
  if (cofIdx != null) t.setAttribute('data-cof', cofIdx);
  svg.appendChild(t);
  return t;
}

/** Click handler for CoF segments: switch the practice key, using the spelling
 *  currently shown on that segment (context respelling — see updateCircleOfFifths).
 *  Falls back to the conventional circle name if the respelled note isn't a
 *  selectable root (e.g. A♯ is not in ROOTS, so B major's vii falls back to Bb). */
function selectCofKey(idx) {
  const sel = document.getElementById('key-select');
  const shown = (S.cofKeyNames && S.cofKeyNames[idx]) || COF_MAJOR[idx];
  const name = ROOTS.includes(shown) ? shown : COF_MAJOR[idx];
  if (sel.value === name) return;
  sel.value = name;
  sel.dispatchEvent(new Event('change'));
}

function buildCircleOfFifths() {
  const svg = document.getElementById('cof-svg');
  const ns = 'http://www.w3.org/2000/svg';
  const R = COF_R;

  for (let i = 0; i < 12; i++) {
    const mid = (i * 30 - 90) * Math.PI / 180;
    const a1 = ((i - 0.5) * 30 - 90) * Math.PI / 180 + COF_GAP;
    const a2 = ((i + 0.5) * 30 - 90) * Math.PI / 180 - COF_GAP;

    // Major-band segment — clickable: switches practice key
    const maj = document.createElementNS(ns, 'path');
    maj.setAttribute('d', annularPath(R.majIn, R.majOut, a1, a2));
    maj.setAttribute('class', 'cof-seg cof-seg-major');
    maj.setAttribute('data-cof', i);
    const tip = document.createElementNS(ns, 'title');
    tip.textContent = 'Practice in ' + displayNote(COF_MAJOR[i]);
    maj.appendChild(tip);
    maj.addEventListener('click', () => selectCofKey(i));
    svg.appendChild(maj);

    // Minor-band segment (also clickable — same key)
    const min = document.createElementNS(ns, 'path');
    min.setAttribute('d', annularPath(R.minIn, R.minOut, a1, a2));
    min.setAttribute('class', 'cof-seg cof-seg-minor');
    min.setAttribute('data-cof', i);
    min.addEventListener('click', () => selectCofKey(i));
    svg.appendChild(min);

    // Major key label + Roman numeral below it (numeral filled dynamically)
    const [kx, ky] = cofPoint(R.keyText, mid);
    const key = cofText(ns, svg, 'cof-key', i, kx, ky);
    key.textContent = displayNote(COF_MAJOR[i]);
    key.dataset.baseY = ky;
    cofText(ns, svg, 'cof-rn', i, kx, ky + 11);

    // Relative minor label
    const [mx, my] = cofPoint(R.minText, mid);
    cofText(ns, svg, 'cof-minor', i, mx, my).textContent = COF_MINOR[i];
  }

  // Center hole: current key + scale name
  cofText(ns, svg, 'cof-center-key', null, COF_CX, COF_CY - 9).id = 'cof-center-key';
  cofText(ns, svg, 'cof-center-scale', null, COF_CX, COF_CY + 17).id = 'cof-center-scale';
}

function updateCircleOfFifths() {
  const curKey = document.getElementById('key-select').value;
  const keyPc = noteToPc(curKey);
  const cofPcs = COF_MAJOR.map(noteToPc);
  const activeIdx = cofPcs.indexOf(keyPc);
  const q = S.currentQ;

  // Map pitch class → Roman numeral for each scale degree
  const pcRoman = {};
  if (q) {
    for (let deg = 0; deg < 7; deg++) {
      const pc = q.scalePcs[deg];
      const stackIdx = q.chordType === '7th' ? [0, 2, 4, 6] : [0, 2, 4];
      const chordPcs = stackIdx.map(i => q.scalePcs[(deg + i) % 7]);
      const rootPc = chordPcs[0];
      const ivs = chordPcs.map(p => ((p - rootPc) % 12 + 12) % 12);
      const quality = getChordQuality(ivs, q.chordType);
      const base = ROMAN[deg];
      const cased = quality.romanCase === 'upper' ? base : base.toLowerCase();
      pcRoman[pc] = cased + quality.suffix;
    }
  }

  const scalePcSet = q ? new Set(q.scalePcs) : new Set();
  const CLS3 = ['active', 'in-scale', 'masked'];

  // Classify a CoF position by whether its major-key PC is in the current scale
  const classify = (cofIdx) => {
    if (cofIdx === activeIdx) return 'active';
    if (scalePcSet.has(cofPcs[cofIdx])) return 'in-scale';
    return 'masked';
  };

  // Context respelling: in-scale positions take the CURRENT scale's spelling
  // (G major's vii position reads F♯, not the circle-conventional G♭; A harmonic
  // minor's ♭6 position reads G♯, not A♭). Out-of-scale positions keep the
  // conventional fixed names.
  const pcSpelling = {};
  if (q) q.scalePcs.forEach((pc, i) => { pcSpelling[pc] = q.scaleNotes[i]; });
  S.cofKeyNames = [];
  for (let idx = 0; idx < 12; idx++) {
    const cls = classify(idx);
    S.cofKeyNames[idx] =
      (cls !== 'masked' && pcSpelling[cofPcs[idx]]) ? pcSpelling[cofPcs[idx]] : COF_MAJOR[idx];
  }

  // Apply segment classes + refresh click tooltips with the shown spelling
  ['cof-seg-major', 'cof-seg-minor'].forEach(sel => {
    document.querySelectorAll('#cof-svg .' + sel).forEach(el => {
      const idx = parseInt(el.dataset.cof);
      el.classList.remove(...CLS3);
      el.classList.add(classify(idx));
      const tip = el.querySelector('title');
      if (tip) tip.textContent = 'Practice in ' + displayNote(S.cofKeyNames[idx]);
    });
  });

  // Roman numeral inside the major segment; key label nudges up to make room
  document.querySelectorAll('#cof-svg .cof-rn').forEach(el => {
    const idx = parseInt(el.dataset.cof);
    const cls = classify(idx);
    el.classList.remove(...CLS3);
    el.classList.add(cls);
    const majorPc = cofPcs[idx];
    el.textContent = (cls !== 'masked' && pcRoman[majorPc]) ? pcRoman[majorPc] : '';
  });
  document.querySelectorAll('#cof-svg .cof-key').forEach(el => {
    const idx = parseInt(el.dataset.cof);
    const cls = classify(idx);
    el.classList.remove(...CLS3);
    el.classList.add(cls);
    el.textContent = displayNote(S.cofKeyNames[idx]);
    const hasRn = cls !== 'masked' && pcRoman[cofPcs[idx]];
    el.setAttribute('y', parseFloat(el.dataset.baseY) + (hasRn ? -7 : 0));
  });

  // Relative minor labels follow the (possibly respelled) major name:
  // minor root = major root's 6th degree (letter + 5), 3 semitones down.
  document.querySelectorAll('#cof-svg .cof-minor').forEach(el => {
    const idx = parseInt(el.dataset.cof);
    const cls = classify(idx);
    el.classList.remove(...CLS3);
    el.classList.add(cls);
    let name = COF_MINOR[idx];
    if (cls !== 'masked' && pcSpelling[cofPcs[idx]]) {
      const majName = pcSpelling[cofPcs[idx]];
      const letter = LETTERS[(LETTERS.indexOf(majName[0]) + 5) % 7];
      name = displayNote(pcToNoteName((cofPcs[idx] + 9) % 12, letter)) + 'm';
    }
    el.textContent = name;
  });

  // Center hole: current key + scale
  document.getElementById('cof-center-key').textContent = displayNote(curKey);
  document.getElementById('cof-center-scale').textContent =
    q ? q.scaleName.replace(' (Ionian)', '') : '';
}

// ======================== SCALE FINGERINGS ========================
/**
 * Standard one-octave fingerings (8 ascending notes incl. the octave), keyed
 * by root PITCH CLASS so enharmonic roots (F#/Gb) share an entry.
 * Each value is [RH, LH] as digit strings. Source: standard charts
 * (pianoscales.org, ABRSM-style). Harmonic & Melodic Minor reuse the minor
 * table — conventional charts keep fingering constant across minor forms.
 * Modes (Dorian/Mixolydian/Lydian) have no standard — intentionally absent.
 */
const MINOR_FING = {
  0:['12312345','54321321'], 1:['34123123','32143213'], 2:['12312345','54321321'],
  3:['31234123','21432132'], 4:['12312345','54321321'], 5:['12341234','54321321'],
  6:['23123123','43213214'], 7:['12312345','54321321'], 8:['34123123','32132143'],
  9:['12312345','54321321'], 10:['21231234','21321432'], 11:['12312345','43214321'],
};
const FINGERINGS = {
  'Major (Ionian)': {
    0:['12312345','54321321'], 1:['23123412','32143213'], 2:['12312345','54321321'],
    3:['31234123','32143213'], 4:['12312345','54321321'], 5:['12341234','54321321'],
    6:['23412312','43213214'], 7:['12312345','54321321'], 8:['34123123','32143213'],
    9:['12312345','54321321'], 10:['21231234','32143213'], 11:['12312345','43214321'],
  },
  'Harmonic Minor': MINOR_FING,
  'Melodic Minor': MINOR_FING,
};

/** Horizontal center (px) of the key for a given midi note on the scale-ref piano. */
function scaleKeyCenterX(midi) {
  const off = midi - MP.start;
  const oct = Math.floor(off / 12), within = off % 12;
  const layout = keyLayout(MP.start % 12);
  const wIdx = layout.whites.indexOf(within);
  if (wIdx >= 0) return (oct * 7 + wIdx) * MP.step + MP.ww / 2;
  const blk = layout.blacks.find(b => b.off === within);
  return (oct * 7 + blk.after) * MP.step + MP.step;
}

/** One row of circled fingering digits aligned under the scale keys.
 *  The RH/LH cap sits in a fixed gutter left of the keyboard. */
function addFingeringRow(container, midiNotes, digits, cap, top) {
  const capEl = document.createElement('div');
  capEl.className = 'fing-cap';
  // Caps center-align with the WHITE-key circle row (the baseline row)
  capEl.style.cssText = 'top:' + (top + 8) + 'px;left:-26px';
  capEl.textContent = cap;
  container.appendChild(capEl);
  midiNotes.forEach((m, i) => {
    const d = document.createElement('div');
    d.className = 'fing-lbl';
    // Black-key digits sit a little higher, mirroring the keyboard topology —
    // also prevents circles from overlapping where key centers are close.
    const y = top + (IS_WHITE[((m % 12) + 12) % 12] ? 5 : -4);
    d.style.cssText = 'left:' + (scaleKeyCenterX(m) - 7) + 'px;top:' + y + 'px';
    d.textContent = digits[i];
    container.appendChild(d);
  });
}

// ======================== SCALE REFERENCE (Mini Piano) ========================
// Scale ref uses S.scaleRefHL

function initScaleRefToggle() {
  const tog = document.getElementById('scale-ref-toggle');
  tog.addEventListener('click', () => {
    S.scaleRefHL = !S.scaleRefHL;
    tog.classList.toggle('on', S.scaleRefHL);
    updateScaleRef();
    renderChordRef();
  });
}

/**
 * Render scale reference as a mini piano showing all 7 scale degrees.
 * Reuses renderMiniPiano — just builds the highlight data in its format.
 */
function updateScaleRef() {
  if (!S.currentQ) return;
  const q = S.currentQ;
  const container = document.getElementById('scale-ref');
  container.innerHTML = '';

  const piano = document.createElement('div');
  piano.className = 'mini-piano';

  // Build MIDI notes for scale degrees (+ octave repeat)
  const scaleMidi = [];
  let cur = MP.start;
  for (let d = 0; d < 7; d++) {
    const pc = q.scalePcs[d];
    while (cur % 12 !== pc) cur++;
    scaleMidi.push(cur);
  }
  const octaveMidi = scaleMidi[0] + 12;
  if (octaveMidi < MP.start + MP.octs * 12) scaleMidi.push(octaveMidi);

  const dispNames = scaleMidi.map((_, i) => displayNote(q.scaleNotes[i % 7]));
  // Degree labels spelled against the parallel major (Mixolydian: 1..6 ♭7),
  // octave repeat reads "8". Reuses the Roman-numeral prefix logic.
  const funcLabels = scaleMidi.map((_, i) =>
    i === 7 ? '8' : getDegreePrefix(q.scaleIv, i) + (i + 1));

  renderMiniPiano(piano, scaleMidi, dispNames, funcLabels, S.scaleRefHL);

  // Fingering rows (RH above LH) under the keys, when a standard table exists
  const fingTable = FINGERINGS[q.scaleName];
  const fing = fingTable && fingTable[q.scalePcs[0]];
  if (fing && scaleMidi.length === 8) {
    piano.style.height = (MP.wh + 46) + 'px';
    addFingeringRow(piano, scaleMidi, fing[0], 'RH', MP.wh + 6);
    addFingeringRow(piano, scaleMidi, fing[1], 'LH', MP.wh + 26);
  }
  container.appendChild(piano);

  // Scale "fingerprint" in the card header: 1 2 3 4 5 6 ♭7
  // (null-guarded so a stale cached index.html can't break the render chain)
  const formulaEl = document.getElementById('scale-formula');
  if (formulaEl) formulaEl.textContent =
    q.scaleIv.map((_, i) => getDegreePrefix(q.scaleIv, i) + (i + 1)).join(' ');
}

// ======================== CHORD REFERENCE ========================

/**
 * Render a compact 7-white-key piano for a single chord.
 * Right edge is determined by the highest chord note (+ 1 white key if it's black).
 * No trailing black keys — only draw blacks between two white keys.
 */
function renderChordPiano(container, chordMidi, dispNames, funcLabels, showHL) {
  const highest = Math.max(...chordMidi);

  // Right boundary: if highest is black, go one white key higher
  let rightWhite = highest;
  if (!IS_WHITE[rightWhite % 12]) rightWhite++;

  // Collect 8 white keys ending at rightWhite
  const whiteKeys = [];
  for (let m = rightWhite; whiteKeys.length < 8; m--) {
    if (IS_WHITE[((m % 12) + 12) % 12]) whiteKeys.unshift(m);
  }

  // Black keys: only between adjacent white keys (2 semitones apart → black in between)
  const blackKeys = [];
  for (let i = 0; i < whiteKeys.length - 1; i++) {
    if (whiteKeys[i + 1] - whiteKeys[i] === 2) {
      blackKeys.push({ midi: whiteKeys[i] + 1, afterIdx: i });
    }
  }

  // Render
  const totalW = 8 * MP.step;
  container.style.width = totalW + 'px';
  container.style.height = MP.wh + 'px';
  container.innerHTML = '';

  const hlSet = new Set(chordMidi);
  const info = {};
  chordMidi.forEach((m, i) => { info[m] = { n: dispNames[i], f: funcLabels[i] }; });

  // White keys
  whiteKeys.forEach((midi, i) => {
    const x = i * MP.step;
    const hl = showHL && hlSet.has(midi);
    const k = document.createElement('div');
    k.className = 'mp-key w' + (hl ? ' hl' : '');
    k.style.cssText = 'left:' + x + 'px;top:0;width:' + MP.ww + 'px;height:' + MP.wh + 'px';
    container.appendChild(k);
    if (hl) addPianoLabels(container, x, MP.ww, info[midi], false, 'w');
  });

  // Black keys
  blackKeys.forEach(b => {
    const x = b.afterIdx * MP.step + MP.step - MP.bw / 2;
    const hl = showHL && hlSet.has(b.midi);
    const k = document.createElement('div');
    k.className = 'mp-key b' + (hl ? ' hl' : '');
    k.style.cssText = 'left:' + x + 'px;top:0;width:' + MP.bw + 'px;height:' + MP.bh + 'px';
    container.appendChild(k);
    if (hl) addPianoLabels(container, x, MP.bw, info[b.midi], false, 'b');
  });
}

/**
 * Render root-position chord diagrams for all 7 scale degrees.
 * Each row: chord name label + mini piano with highlighted chord tones.
 */
function renderChordRef() {
  const container = document.getElementById('chord-ref');
  if (!container) return;
  if (!S.currentQ) { container.innerHTML = ''; return; }

  const q = S.currentQ;
  const chordType = q.chordType;
  const stackIdx = chordType === '7th' ? [0, 2, 4, 6] : [0, 2, 4];
  container.innerHTML = '';

  for (let deg = 0; deg < 7; deg++) {
    const chordPcs = stackIdx.map(i => q.scalePcs[(deg + i) % 7]);
    const chordNotes = stackIdx.map(i => q.scaleNotes[(deg + i) % 7]);
    const rootPc = chordPcs[0];
    const intervalsFromRoot = chordPcs.map(pc => ((pc - rootPc) % 12 + 12) % 12);
    const quality = getChordQuality(intervalsFromRoot, chordType);
    // Chord name: e.g. "G Maj7", "A m7"
    const chordName = displayNote(chordNotes[0]) + (quality.chordSymbol ? ' ' + quality.chordSymbol : '');

    const row = document.createElement('div');
    row.className = 'chord-ref-row';

    // Label: concrete chord name
    const label = document.createElement('div');
    label.className = 'chord-ref-label' + (deg === q.degree ? ' active' : '');
    label.textContent = chordName;
    row.appendChild(label);

    // Mini piano in a scaled-down wrapper
    const wrapper = document.createElement('div');
    wrapper.className = 'chord-ref-piano-wrap';
    const piano = document.createElement('div');
    piano.className = 'mini-piano';

    // Build ascending MIDI notes for root position chord
    const chordMidi = [];
    let cur = 48;
    for (const pc of chordPcs) {
      while (cur % 12 !== pc) cur++;
      chordMidi.push(cur);
      cur++;
    }

    const dispNames = chordMidi.map((_, i) => displayNote(chordNotes[i]));
    const funcLabels = chordMidi.map((_, i) => ivToFunc(intervalsFromRoot[i]));

    renderChordPiano(piano, chordMidi, dispNames, funcLabels, S.scaleRefHL);
    wrapper.appendChild(piano);
    row.appendChild(wrapper);
    container.appendChild(row);
  }
}

// ======================== MODE HELPERS ========================
function setChordTypeButton(type) {
  document.querySelectorAll('.type-btn').forEach(b => b.classList.toggle('active', b.dataset.type === type));
}

function enforceModeConstraints(mode) {
  const scaleSel = document.getElementById('scale-select');
  const needsMajor = mode === '251' || mode === '251-all' || mode === 'secondary';
  if (needsMajor && scaleSel.value !== 'Major (Ionian)') {
    scaleSel.value = 'Major (Ionian)';
    showScaleNotice();
  }
  if (mode === 'secondary' && getChordType() !== '7th') {
    setChordTypeButton('7th');
  }
}

/** Map the two-level UI state (content + sub-choice) onto the internal mode id. */
function currentUiMode() {
  if (S.uiContent === 'degrees') return S.uiOrder === 'sequential' ? 'sequential' : 'random';
  if (S.uiContent === '251') return S.uiKeys === 'all' ? '251-all' : '251';
  return 'secondary';
}

/** Sync mode-bar buttons, contextual sub-controls, and the scale lock. */
function updateModeBarUI() {
  document.querySelectorAll('.content-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.content === S.uiContent));
  document.querySelectorAll('#sub-degrees .sub-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.order === S.uiOrder));
  document.querySelectorAll('#sub-251 .sub-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.keys === S.uiKeys));

  document.getElementById('sub-degrees').style.display = S.uiContent === 'degrees' ? '' : 'none';
  document.getElementById('sub-251').style.display = S.uiContent === '251' ? '' : 'none';
  // Mix applies wherever a weighted random pick happens:
  // Degrees+Random (degree distribution) and Secondary V (tonicization targets)
  const showMix = (S.uiContent === 'degrees' && S.uiOrder === 'random') || S.uiContent === 'secondary';
  document.getElementById('sub-mix').style.display = showMix ? '' : 'none';

  // ii-V-I and Secondary V are Major-only — lock the scale selector there
  document.getElementById('scale-select').disabled = S.uiContent !== 'degrees';
}

function applyUiMode() {
  const mode = currentUiMode();
  S.pendingQ = null;  // discard stale pre-built question
  // These modes only apply cleanly to Major — auto-switch scale if needed.
  enforceModeConstraints(mode);
  S.mode = mode;
  S.modeIndex = 0;
  if (mode === '251-all') {
    const curKey = document.getElementById('key-select').value;
    const idx = KEY_CIRCLE_4THS.indexOf(curKey);
    S.keyCircleIdx = idx >= 0 ? idx : 0;
  }
  updateModeBarUI();
  nextQuestion();
}

/** Toast notification for brief messages */
function showToast(msg, duration) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), duration || 2000);
}

function showScaleNotice() {
  showToast('Switched to Major (Ionian)');
}

// ======================== EVENT HANDLERS ========================
function setupEvents() {
  // Chord type buttons
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      setChordTypeButton(btn.dataset.type);
      enforceModeConstraints(S.mode);
      S.modeIndex = 0;
      S.pendingQ = null;
      nextQuestion();
    });
  });

  // Practice content + contextual sub-choice buttons
  document.querySelectorAll('.content-btn').forEach(btn => {
    btn.addEventListener('click', () => { S.uiContent = btn.dataset.content; applyUiMode(); });
  });
  document.querySelectorAll('#sub-degrees .sub-btn').forEach(btn => {
    btn.addEventListener('click', () => { S.uiOrder = btn.dataset.order; applyUiMode(); });
  });
  document.querySelectorAll('#sub-251 .sub-btn').forEach(btn => {
    btn.addEventListener('click', () => { S.uiKeys = btn.dataset.keys; applyUiMode(); });
  });

  // Key / scale change
  document.getElementById('key-select').addEventListener('change', () => {
    S.modeIndex = 0;
    S.pendingQ = null; // discard stale pre-built question from old key
    if (S.mode === '251-all') {
      const curKey = document.getElementById('key-select').value;
      const idx = KEY_CIRCLE_4THS.indexOf(curKey);
      S.keyCircleIdx = idx >= 0 ? idx : 0;
    }
    nextQuestion();
  });
  document.getElementById('scale-select').addEventListener('change', () => {
    enforceModeConstraints(S.mode);
    S.modeIndex = 0;
    S.pendingQ = null;
    nextQuestion();
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') { e.preventDefault(); nextQuestion(); }
    else if (e.code === 'KeyA') { showAnswer(); }
  });
}

// ======================== INIT ========================
function init() {
  populateSelectors();
  buildCircleOfFifths();
  initScaleRefToggle();
  initFeedbackToggles();
  initDistSelect();
  initThemePicker();
  updateModeBarUI();
  setupEvents();
  initMidi();
  nextQuestion();
  S.practiceCount = 0;
  document.getElementById('score').textContent = 'Practiced: 0';
}

document.addEventListener('DOMContentLoaded', init);
