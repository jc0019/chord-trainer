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
};

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
  // Random: avoid repeats
  const candidates = [0,1,2,3,4,5,6].filter(d => d !== S.lastDegree);
  return candidates[Math.floor(Math.random() * candidates.length)];
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

function pickSecondaryTargetDegree() {
  const candidates = SECONDARY_TARGETS.filter(d => d !== S.lastDegree);
  const degree = candidates[Math.floor(Math.random() * candidates.length)];
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
        if (S.currentQ.secondary && S.currentQ.secondaryStage === 'dominant') {
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
        document.getElementById('score').textContent = 'Practiced: ' + S.practiceCount;
        document.getElementById('roman-numeral').classList.add('correct');
        // pendingQ is already pre-built; no need to rebuild or update preview
        return;
      }
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
  renderMiniPiano(piano, midi, disp, funcLabels, S.voicingHL, altMidi);
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
// Radii: rings, wedge extent, and text placement for each layer
const COF_R = {
  wedge: 158,      // wedge sector outer edge
  rOuter: 148,     // outer ring line
  rMid: 100,       // middle ring line (same ~48px band as outer)
  rInner: 52,      // inner ring line (same ~48px band as middle)
  rnOuter: 162,    // outer Roman numeral (outside outer ring)
  key: 126,        // note name (between outer and mid ring)
  minor: 76,       // relative minor name (between mid and inner ring)
};

/** SVG arc sector path from center, spanning startAngle→endAngle at given radius. */
function wedgePath(r, a1, a2) {
  const x1 = COF_CX + r * Math.cos(a1), y1 = COF_CY + r * Math.sin(a1);
  const x2 = COF_CX + r * Math.cos(a2), y2 = COF_CY + r * Math.sin(a2);
  return 'M ' + COF_CX + ' ' + COF_CY + ' L ' + x1 + ' ' + y1 +
    ' A ' + r + ' ' + r + ' 0 0 1 ' + x2 + ' ' + y2 + ' Z';
}

function cofText(ns, svg, r, angle, cls, cofIdx) {
  const t = document.createElementNS(ns, 'text');
  t.setAttribute('x', COF_CX + r * Math.cos(angle));
  t.setAttribute('y', COF_CY + r * Math.sin(angle));
  t.setAttribute('class', cls);
  t.setAttribute('data-cof', cofIdx);
  svg.appendChild(t);
  return t;
}

function buildCircleOfFifths() {
  const svg = document.getElementById('cof-svg');
  const ns = 'http://www.w3.org/2000/svg';
  const R = COF_R;

  // Ring lines
  [R.rOuter, R.rMid, R.rInner].forEach(r => {
    const ring = document.createElementNS(ns, 'circle');
    ring.setAttribute('cx', COF_CX); ring.setAttribute('cy', COF_CY);
    ring.setAttribute('r', r); ring.setAttribute('class', 'cof-ring');
    svg.appendChild(ring);
  });

  for (let i = 0; i < 12; i++) {
    const angle = (i * 30 - 90) * Math.PI / 180;
    const a1 = ((i - 0.5) * 30 - 90) * Math.PI / 180;
    const a2 = ((i + 0.5) * 30 - 90) * Math.PI / 180;

    // Background wedge sector
    const wedge = document.createElementNS(ns, 'path');
    wedge.setAttribute('d', wedgePath(R.wedge, a1, a2));
    wedge.setAttribute('class', 'cof-wedge');
    wedge.setAttribute('data-cof', i);
    svg.appendChild(wedge);

    // Outer Roman numeral (dynamic, outside outer ring)
    cofText(ns, svg, R.rnOuter, angle, 'cof-rn cof-rn-out', i);

    // Note name (static)
    cofText(ns, svg, R.key, angle, 'cof-key', i).textContent = displayNote(COF_MAJOR[i]);

    // Relative minor name (static)
    cofText(ns, svg, R.minor, angle, 'cof-minor', i).textContent = COF_MINOR[i];
  }
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

  // Apply wedge / note-name / minor-name classes
  ['cof-wedge', 'cof-key', 'cof-minor'].forEach(sel => {
    document.querySelectorAll('#cof-svg .' + sel).forEach(el => {
      const cls = classify(parseInt(el.dataset.cof));
      el.classList.remove(...CLS3);
      el.classList.add(cls);
    });
  });

  // Outer Roman numeral: degree of the major key at this CoF position
  document.querySelectorAll('#cof-svg .cof-rn-out').forEach(el => {
    const idx = parseInt(el.dataset.cof);
    const cls = classify(idx);
    el.classList.remove(...CLS3);
    el.classList.add(cls);
    const majorPc = cofPcs[idx];
    el.textContent = (cls !== 'masked' && pcRoman[majorPc]) ? pcRoman[majorPc] : '';
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
  const funcLabels = scaleMidi.map((_, i) => String((i % 7) + 1));

  renderMiniPiano(piano, scaleMidi, dispNames, funcLabels, S.scaleRefHL);
  container.appendChild(piano);
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

function setMode(mode) {
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
  document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
  document.querySelector('.mode-btn[data-mode="' + mode + '"]').classList.add('active');
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

  // Mode buttons
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => setMode(btn.dataset.mode));
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
  setupEvents();
  initMidi();
  nextQuestion();
  S.practiceCount = 0;
  document.getElementById('score').textContent = 'Practiced: 0';
}

document.addEventListener('DOMContentLoaded', init);
