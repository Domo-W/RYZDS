import type { CanvasOp } from "./canvas/ops";

export type Demo = { title: string; ops: CanvasOp[] };

const S = (text: string): CanvasOp => ({ op: "say", text });
const W = (ms: number): CanvasOp => ({ op: "wait", ms });

function networkSvg() {
  const inp = [80, 150, 220], hid = [50, 117, 183, 250], out = [110, 190];
  let lines = "";
  for (const y1 of inp) for (const y2 of hid) lines += `<line x1='60' y1='${y1}' x2='220' y2='${y2}'/>`;
  for (const y1 of hid) for (const y2 of out) lines += `<line x1='220' y1='${y1}' x2='380' y2='${y2}'/>`;
  const circ = (x: number, ys: number[], fill: string) => ys.map((y) => `<g filter='url(#ns)'><circle cx='${x}' cy='${y}' r='16' fill='${fill}'/><circle cx='${x}' cy='${y}' r='16' fill='url(#n1)'/></g>`).join("");
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 440 300'><defs><radialGradient id='n1' cx='.35' cy='.3'><stop offset='0' stop-color='#fff' stop-opacity='.9'/><stop offset='1' stop-color='#000' stop-opacity='.15'/></radialGradient><filter id='ns' x='-20%' y='-20%' width='140%' height='140%'><feDropShadow dx='0' dy='3' stdDeviation='3' flood-color='#000' flood-opacity='.25'/></filter></defs><g stroke='#b8bdd1' stroke-width='1.5'>${lines}</g>${circ(60, inp, "#4f7df3")}${circ(220, hid, "#8b5cf6")}${circ(380, out, "#f59e0b")}<g font-family='sans-serif' font-size='14' fill='#555' text-anchor='middle'><text x='60' y='32'>Input</text><text x='220' y='22'>Hidden</text><text x='380' y='32'>Output</text></g></svg>`;
}

const lossSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 200'><polyline points='40,30 40,170 260,170' fill='none' stroke='#999' stroke-width='2'/><path d='M45,45 C90,60 110,120 150,140 S230,160 255,165' fill='none' stroke='#d97757' stroke-width='5' stroke-linecap='round'/><text x='150' y='192' text-anchor='middle' font-family='sans-serif' font-size='13' fill='#555'>training steps →</text><text x='22' y='100' transform='rotate(-90 22,100)' text-anchor='middle' font-family='sans-serif' font-size='13' fill='#555'>loss</text></svg>`;

const lockSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 160'><path d='M70,75 V55 a30,30 0 0 1 60,0 V75' fill='none' stroke='#555' stroke-width='8' stroke-linecap='round'/><rect x='50' y='75' width='100' height='65' rx='12' fill='#f2b134'/><circle cx='100' cy='103' r='8' fill='#333'/><rect x='97' y='103' width='6' height='20' rx='3' fill='#333'/></svg>`;

function shift(ops: CanvasOp[], dx: number, dy = 0): CanvasOp[] {
  return ops.map((o) => ("x" in o && typeof o.x === "number" ? ({ ...o, x: o.x + dx, y: ("y" in o && typeof o.y === "number" ? o.y + dy : undefined) } as CanvasOp) : o));
}

/** Stage 3: what happens after you ping the "Backpropagate" box and pick Explain. */
export const CURSOR_DEMO: CanvasOp[] = [
  S("Pinged! Let me zoom in on backpropagation right where you pointed."),
  { op: "frame", id: "bp_f", x: 640, y: 860, w: 560, h: 330, name: "Backpropagation, up close" },
  { op: "text", id: "bp_t", x: 670, y: 890, w: 500, size: "m", text: "Backprop asks every weight: how much did YOU contribute to the error? The chain rule passes blame backwards, layer by layer." },
  { op: "shape", id: "bp_1", kind: "ellipse", x: 670, y: 1040, w: 140, h: 70, label: "Output error", color: "red", fill: "semi" },
  { op: "shape", id: "bp_2", kind: "ellipse", x: 850, y: 1040, w: 140, h: 70, label: "Hidden blame", color: "violet", fill: "semi" },
  { op: "arrow", id: "bp_a1", from: "bp_1", to: "bp_2", label: "chain rule" },
  { op: "shape", id: "bp_3", kind: "ellipse", x: 1030, y: 1040, w: 140, h: 70, label: "Weight nudges", color: "green", fill: "semi" },
  { op: "arrow", id: "bp_a2", from: "bp_2", to: "bp_3" },
  { op: "arrow", id: "bp_a3", from: "nn_s3", to: "bp_f", color: "grey", dash: "dashed" },
  { op: "focus", ids: ["bp_f"] },
  W(900),
  S("That's the cursor: point at anything on the canvas and just ask. Thanks for watching!"),
  { op: "focus", ids: ["nn_f", "bp_f"] },
];

export const STAGE_NAMES = ["Reading: explain the research paper", "Drawing: how the experiment ran", "Cursor: ping the flaw & ask why"];

const interfacesSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 200'><defs><filter id='s2' x='-20%' y='-20%' width='140%' height='140%'><feDropShadow dx='0' dy='5' stdDeviation='5' flood-color='#000' flood-opacity='.16'/></filter><linearGradient id='bg2' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#f8f9ff'/><stop offset='1' stop-color='#eceefb'/></linearGradient></defs><g filter='url(#s2)'><g font-family='sans-serif' font-size='12' fill='#555' text-anchor='middle'><text x='100' y='22'>Separate chat panel</text><text x='300' y='22'>Inline explanation</text></g><rect x='30' y='35' width='90' height='140' rx='6' fill='#fff' stroke='#c9ccd6'/><g stroke='#d4d6de' stroke-width='4' stroke-linecap='round'><line x1='42' y1='55' x2='108' y2='55'/><line x1='42' y1='70' x2='100' y2='70'/><line x1='42' y1='100' x2='108' y2='100'/><line x1='42' y1='115' x2='95' y2='115'/><line x1='42' y1='145' x2='105' y2='145'/></g><line x1='42' y1='85' x2='108' y2='85' stroke='#f2b134' stroke-width='6' stroke-linecap='round'/><rect x='128' y='35' width='52' height='140' rx='6' fill='#eceef4' stroke='#c9ccd6'/><rect x='134' y='120' width='40' height='14' rx='7' fill='#9ca3af'/><rect x='134' y='140' width='40' height='14' rx='7' fill='#4f7df3'/><path d='M108,85 C120,85 120,127 134,127' fill='none' stroke='#d97757' stroke-width='2' stroke-dasharray='4 3'/><rect x='230' y='35' width='140' height='140' rx='6' fill='#fff' stroke='#c9ccd6'/><g stroke='#d4d6de' stroke-width='4' stroke-linecap='round'><line x1='242' y1='55' x2='355' y2='55'/><line x1='242' y1='70' x2='340' y2='70'/><line x1='242' y1='145' x2='350' y2='145'/><line x1='242' y1='160' x2='330' y2='160'/></g><line x1='242' y1='85' x2='330' y2='85' stroke='#f2b134' stroke-width='6' stroke-linecap='round'/><rect x='252' y='96' width='106' height='36' rx='8' fill='#dbe7ff' stroke='#4f7df3'/><path d='M262,96 l6,-8 l6,8' fill='#dbe7ff' stroke='#4f7df3'/><g stroke='#4f7df3' stroke-width='3' stroke-linecap='round'><line x1='262' y1='110' x2='340' y2='110'/><line x1='262' y1='121' x2='320' y2='121'/></g></g></svg>`;

const peopleSvg = (() => { let g = "<defs><radialGradient id='pg' cx='.35' cy='.3'><stop offset='0' stop-color='#9bb8ff'/><stop offset='1' stop-color='#3b63d6'/></radialGradient></defs>"; for (let i = 0; i < 24; i++) { const x = 18 + (i % 12) * 30, y = i < 12 ? 26 : 62; g += `<circle cx='${x}' cy='${y - 10}' r='6' fill='url(#pg)'/><path d='M${x - 10},${y + 10} a10,10 0 0 1 20,0 z' fill='url(#pg)'/>`; } return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 380 90'>${g}</svg>`; })();

const orderSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 920 200'><defs><filter id='s3' x='-10%' y='-20%' width='120%' height='140%'><feDropShadow dx='0' dy='4' stdDeviation='4' flood-color='#000' flood-opacity='.18'/></filter><linearGradient id='bg3' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#f4fdf6'/><stop offset='1' stop-color='#e6f5ea'/></linearGradient></defs><g font-family='sans-serif' font-size='14' fill='#333'><text x='20' y='40' font-weight='bold'>This study (fixed order)</text><text x='20' y='135' font-weight='bold'>Better (randomized)</text></g><g font-family='sans-serif' font-size='13' fill='#fff' text-anchor='middle' filter='url(#s3)'><rect x='230' y='22' width='150' height='34' rx='8' fill='#9ca3af'/><text x='305' y='44'>A · chat</text><rect x='410' y='22' width='150' height='34' rx='8' fill='#4f7df3'/><text x='485' y='44'>B · inline</text><rect x='590' y='22' width='150' height='34' rx='8' fill='#9ca3af'/><text x='665' y='44'>A · chat</text><rect x='770' y='22' width='130' height='34' rx='8' fill='#4f7df3'/><text x='835' y='44'>B · inline</text><rect x='230' y='117' width='150' height='34' rx='8' fill='#4f7df3'/><text x='305' y='139'>B · inline</text><rect x='410' y='117' width='150' height='34' rx='8' fill='#9ca3af'/><text x='485' y='139'>A · chat</text><rect x='590' y='117' width='150' height='34' rx='8' fill='#9ca3af'/><text x='665' y='139'>A · chat</text><rect x='770' y='117' width='130' height='34' rx='8' fill='#4f7df3'/><text x='835' y='139'>B · inline</text></g><text x='230' y='80' font-family='sans-serif' font-size='12' fill='#c0392b'>inline always second → practice + fatigue leak into the score</text><text x='230' y='175' font-family='sans-serif' font-size='12' fill='#2e9e5b'>order shuffled per person → the gap is about the help, not the order</text></svg>`;

const drakeMeme = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 420 300'><defs><filter id='ms' x='-10%' y='-10%' width='120%' height='130%'><feDropShadow dx='0' dy='8' stdDeviation='8' flood-color='#000' flood-opacity='.22'/></filter></defs><g filter='url(#ms)'><rect x='10' y='10' width='400' height='280' rx='18' fill='#fff'/></g><rect x='10' y='10' width='150' height='140' rx='18' fill='#ffd7c2'/><rect x='10' y='150' width='150' height='140' rx='18' fill='#c9f2d2'/><text x='85' y='95' text-anchor='middle' font-size='64'>🙅‍♂️</text><text x='85' y='235' text-anchor='middle' font-size='64'>😏👉</text><g font-family='Impact, Arial Black, sans-serif' font-size='20' fill='#222'><text x='285' y='70' text-anchor='middle'>Scroll away to a chat</text><text x='285' y='98' text-anchor='middle'>panel, lose your place</text><text x='285' y='210' text-anchor='middle'>Explanation right</text><text x='285' y='238' text-anchor='middle'>next to the sentence</text></g><line x1='10' y1='150' x2='410' y2='150' stroke='#ddd'/></svg>`;

const brainMeme = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 520 300'><defs><filter id='bs' x='-10%' y='-10%' width='120%' height='130%'><feDropShadow dx='0' dy='8' stdDeviation='8' flood-color='#000' flood-opacity='.22'/></filter></defs><g filter='url(#bs)'><rect x='10' y='10' width='500' height='280' rx='18' fill='#fff'/></g><g font-size='54' text-anchor='middle'><text x='70' y='78'>🧠</text><text x='70' y='168'>🤯</text><text x='70' y='258'>🌌🧠</text></g><g font-family='Impact, Arial Black, sans-serif' font-size='19' fill='#222'><text x='130' y='58'>"74 &gt; 62, inline help wins,</text><text x='130' y='84'>ship it" (fixed order, n=24)</text><text x='130' y='148'>"wait… everyone did inline</text><text x='130' y='174'>second. practice effect?"</text><text x='130' y='238'>randomize, counterbalance,</text><text x='130' y='264'>report error bars</text></g><g stroke='#e5e5e5'><line x1='10' y1='100' x2='510' y2='100'/><line x1='10' y1='190' x2='510' y2='190'/></g></svg>`;

const figureSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300'><defs><linearGradient id='g1' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#b9d49f'/><stop offset='1' stop-color='#7fa366'/></linearGradient><linearGradient id='g2' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#7ea2ff'/><stop offset='1' stop-color='#3b63d6'/></linearGradient><filter id='sh' x='-20%' y='-20%' width='140%' height='140%'><feDropShadow dx='0' dy='6' stdDeviation='6' flood-color='#000' flood-opacity='.18'/></filter></defs><text x='200' y='30' text-anchor='middle' font-family='sans-serif' font-size='15' font-weight='bold' fill='#293e36'>Figure 1 · Comprehension score (0–100)</text><g stroke='#cfd3dd' stroke-width='1'><line x1='70' y1='250' x2='370' y2='250'/><line x1='70' y1='200' x2='370' y2='200'/><line x1='70' y1='150' x2='370' y2='150'/><line x1='70' y1='100' x2='370' y2='100'/></g><g filter='url(#sh)'><rect x='120' y='126' width='80' height='124' rx='3' fill='url(#g1)'/><polygon points='120,126 138,112 218,112 200,126' fill='#d5e6c4'/><polygon points='200,126 218,112 218,236 200,250' fill='#5f8a4b'/></g><g filter='url(#sh)'><rect x='250' y='102' width='80' height='148' rx='3' fill='url(#g2)'/><polygon points='250,102 268,88 348,88 330,102' fill='#c7d6ff'/><polygon points='330,102 348,88 348,236 330,250' fill='#2c4fb5'/></g><g font-family='sans-serif' text-anchor='middle' fill='#293e36'><text x='160' y='98' font-size='20' font-weight='bold'>62</text><text x='290' y='74' font-size='20' font-weight='bold'>74</text><text x='160' y='275' font-size='13'>Separate chat</text><text x='290' y='275' font-size='13'>Inline help</text></g></svg>`;

/** Stage 4: Marg reads the sample paper on the left and explains it. */
const PAPER_DEMO_RAW: CanvasOp[] = [
  S("I read the paper on the left: the abstract, Figure 1, then the methods. Here's the gist."),
  { op: "frame", id: "pp_f", x: 100, y: 1280, w: 1100, h: 1000, name: "Paper: Reading with Local Explanations" },
  { op: "text", id: "pp_t1", x: 140, y: 1310, text: "Reading with Local Explanations", size: "xl" },
  { op: "text", id: "pp_t2", x: 140, y: 1365, w: 560, size: "m", text: "A fictional study: do explanations placed beside the passage help readers understand without losing their place? (§1, page 1)" },
  W(300),
  S("The core comparison: a separate chat panel versus inline help right next to the text."),
  { op: "shape", id: "pp_s1", kind: "rectangle", x: 140, y: 1470, w: 220, h: 90, label: "Separate chat panel", color: "grey", fill: "semi" },
  { op: "shape", id: "pp_s2", kind: "rectangle", x: 480, y: 1470, w: 220, h: 90, label: "Inline explanation", color: "blue", fill: "semi" },
  { op: "arrow", id: "pp_a1", from: "pp_s1", to: "pp_s2", label: "vs" },
  { op: "svg", id: "pp_ill", x: 760, y: 1740, w: 400, h: 200, svg: interfacesSvg },
  { op: "note", id: "pp_n1", x: 140, y: 1600, text: "Context recovery cost: the effort to find your passage again after getting help. (§2)", color: "yellow" },
  { op: "focus", ids: ["pp_t1", "pp_s1", "pp_s2", "pp_n1", "pp_ill"] },
  W(500),
  S("Or, in meme form:"),
  { op: "svg", id: "pp_meme", x: 140, y: 1960, w: 420, h: 300, svg: drakeMeme },
  { op: "focus", ids: ["pp_meme"], zoom: 1.1 },
  W(1400),
  S("Figure 1 on page 2 is the headline result. Let me redraw it."),
  { op: "svg", id: "pp_fig", x: 760, y: 1310, w: 400, h: 300, svg: figureSvg },
  { op: "text", id: "pp_t3", x: 760, y: 1625, w: 400, size: "s", text: "Figure 1 (p.2): 74 vs 62 on a 100-point quiz — 12 points higher with inline help. No error bars, no significance tests." },
  { op: "focus", ids: ["pp_fig", "pp_t3"] },
  W(700),
  S("Now the methods on page 3, which decide how much to trust that chart."),
  { op: "shape", id: "pp_s3", kind: "rectangle", x: 380, y: 1640, w: 340, h: 70, label: "24 participants · fixed order · not randomized", color: "light-red", fill: "semi" },
  { op: "shape", id: "pp_s4", kind: "rectangle", x: 380, y: 1740, w: 340, h: 70, label: "Practice / fatigue confound → no causal claim", color: "red", fill: "semi" },
  { op: "arrow", id: "pp_a2", from: "pp_s3", to: "pp_s4" },
  { op: "note", id: "pp_n2", x: 140, y: 1740, text: "Next experiment (§6): randomize order, counterbalance passages, measure delayed recall.", color: "light-green" },
  { op: "focus", ids: ["pp_s3", "pp_s4", "pp_n2"] },
  W(600),
  S("Bottom line: a promising pattern, but this design can't prove inline help causes better understanding."),
  { op: "focus", ids: ["pp_f"] },
];
export const PAPER_DEMO: CanvasOp[] = shift(PAPER_DEMO_RAW, 0, -1180);

/** Stage 2: the study design from §4 (page 3), drawn as a flow to the right of the summary. */
export const EXPERIMENT_DEMO: CanvasOp[] = [
  S("Let me draw how the experiment actually ran, so you can see where the problem hides."),
  { op: "frame", id: "ex_f", x: 1300, y: 100, w: 1000, h: 640, name: "The study design (§4, page 3)" },
  { op: "text", id: "ex_t1", x: 1340, y: 130, text: "How the experiment ran", size: "xl" },
  { op: "shape", id: "ex_s1", kind: "ellipse", x: 1340, y: 220, w: 200, h: 90, label: "24 participants", color: "blue", fill: "semi" },
  { op: "svg", id: "ex_people", x: 1340, y: 320, w: 230, h: 55, svg: peopleSvg },
  { op: "shape", id: "ex_s2", kind: "rectangle", x: 1600, y: 220, w: 260, h: 90, label: "Passage A + separate chat", color: "grey", fill: "semi" },
  { op: "arrow", id: "ex_a1", from: "ex_s1", to: "ex_s2" },
  { op: "shape", id: "ex_s3", kind: "rectangle", x: 1920, y: 220, w: 260, h: 90, label: "Quiz 1 · 10 questions", color: "light-green", fill: "semi" },
  { op: "arrow", id: "ex_a2", from: "ex_s2", to: "ex_s3" },
  W(300),
  S("Then everyone did the second passage with inline help. Same order for all 24 people."),
  { op: "shape", id: "ex_s4", kind: "rectangle", x: 1600, y: 380, w: 260, h: 90, label: "Passage B + inline help", color: "blue", fill: "semi" },
  { op: "arrow", id: "ex_a3", from: "ex_s3", to: "ex_s4", label: "always this order" },
  { op: "shape", id: "ex_s5", kind: "rectangle", x: 1920, y: 380, w: 260, h: 90, label: "Quiz 2 · 10 questions", color: "light-green", fill: "semi" },
  { op: "arrow", id: "ex_a4", from: "ex_s4", to: "ex_s5" },
  { op: "focus", ids: ["ex_s1", "ex_s2", "ex_s3", "ex_s4", "ex_s5"] },
  W(700),
  S("That fixed order is the catch: practice and fatigue get mixed into the 12-point gap."),
  { op: "note", id: "ex_n1", x: 1340, y: 400, text: "Fixed order = practice & fatigue effects are mixed into the result. Not randomized. (§5)", color: "light-red" },
  { op: "shape", id: "ex_s6", kind: "rectangle", x: 1600, y: 560, w: 580, h: 80, label: "Result: 62 → 74, but no randomization, no error bars", color: "orange", fill: "semi" },
  { op: "arrow", id: "ex_a5", from: "ex_s5", to: "ex_s6" },
  { op: "arrow", id: "ex_a6", from: "ex_n1", to: "ex_s6", color: "red", dash: "dashed" },
  { op: "focus", ids: ["ex_f"] },
  W(500),
  S("So the chart is real, but the design can't tell us what caused the jump."),
];

/** Stage 3: what Marg draws after you ping the "fixed order" note and pick Explain. */
export const CURSOR_PAPER_DEMO: CanvasOp[] = [
  S("One more thing: why that fixed order breaks the causal claim, and how §6 would fix it."),
  { op: "frame", id: "fx_f", x: 1300, y: 800, w: 1000, h: 920, name: "Why it can't prove causality, and the fix (§5–6)" },
  { op: "text", id: "fx_t", x: 1340, y: 830, w: 920, size: "m", text: "Inline help always came second, so any improvement could be practice, fatigue, or an easier passage. The paper's own fix:" },
  { op: "shape", id: "fx_1", kind: "rectangle", x: 1340, y: 960, w: 280, h: 90, label: "Randomize the order", color: "green", fill: "semi" },
  { op: "shape", id: "fx_2", kind: "rectangle", x: 1660, y: 960, w: 280, h: 90, label: "Counterbalance passages", color: "green", fill: "semi" },
  { op: "arrow", id: "fx_a1", from: "fx_1", to: "fx_2" },
  { op: "shape", id: "fx_3", kind: "rectangle", x: 1980, y: 960, w: 280, h: 90, label: "Delayed recall + error bars", color: "green", fill: "semi" },
  { op: "arrow", id: "fx_a2", from: "fx_2", to: "fx_3" },
  { op: "arrow", id: "fx_a3", from: "ex_n1", to: "fx_f", color: "grey", dash: "dashed" },
  { op: "svg", id: "fx_ill", x: 1340, y: 1080, w: 920, h: 200, svg: orderSvg },
  { op: "focus", ids: ["fx_ill", "fx_1", "fx_2", "fx_3"] },
  W(900),
  S("The peer-review brain evolution, basically:"),
  { op: "svg", id: "fx_meme", x: 1340, y: 1320, w: 520, h: 300, svg: brainMeme },
  { op: "focus", ids: ["fx_meme"], zoom: 1.1 },
  W(1600),
  S("That's Marg: it reads the paper with you, draws the idea, and digs in wherever you ask. Thanks for watching!"),
  { op: "focus", ids: ["pp_f", "ex_f", "fx_f"] },
];

export const DEMOS: Demo[] = [
  {
    title: "How a neural network learns",
    ops: [
      S("Let's walk through how a neural network learns, step by step."),
      { op: "frame", id: "nn_f", x: 100, y: 100, w: 1080, h: 700, name: "How a neural network learns" },
      { op: "text", id: "nn_t1", x: 140, y: 130, text: "How a neural network learns", size: "xl" },
      { op: "text", id: "nn_t2", x: 140, y: 190, w: 520, size: "m", text: "A network is layers of tiny math units joined by weights. Learning means nudging those weights until the outputs stop being wrong." },
      W(400),
      S("First, the shape of the thing: layers of neurons connected by weights."),
      { op: "svg", id: "nn_net", x: 140, y: 290, w: 440, h: 300, svg: networkSvg() },
      { op: "focus", ids: ["nn_t1", "nn_t2", "nn_net"] },
      W(900),
      S("Now the learning loop: four steps repeated thousands of times."),
      { op: "shape", id: "nn_s1", kind: "rectangle", x: 640, y: 290, w: 200, h: 80, label: "1. Forward pass", color: "blue", fill: "semi" },
      { op: "shape", id: "nn_s2", kind: "rectangle", x: 920, y: 290, w: 200, h: 80, label: "2. Measure loss", color: "orange", fill: "semi" },
      { op: "arrow", id: "nn_a1", from: "nn_s1", to: "nn_s2" },
      { op: "shape", id: "nn_s3", kind: "rectangle", x: 920, y: 450, w: 200, h: 80, label: "3. Backpropagate", color: "violet", fill: "semi" },
      { op: "arrow", id: "nn_a2", from: "nn_s2", to: "nn_s3" },
      { op: "shape", id: "nn_s4", kind: "rectangle", x: 640, y: 450, w: 200, h: 80, label: "4. Update weights", color: "green", fill: "semi" },
      { op: "arrow", id: "nn_a3", from: "nn_s3", to: "nn_s4" },
      { op: "arrow", id: "nn_a4", from: "nn_s4", to: "nn_s1", label: "repeat" },
      { op: "focus", ids: ["nn_s1", "nn_s2", "nn_s3", "nn_s4"] },
      W(900),
      S("The update step is gradient descent: rolling downhill on the loss landscape."),
      { op: "svg", id: "nn_loss", x: 640, y: 570, w: 300, h: 200, svg: lossSvg },
      { op: "note", id: "nn_n1", x: 960, y: 570, text: "Takeaway: predict → measure error → adjust weights a little → repeat.", color: "yellow" },
      { op: "focus", ids: ["nn_loss", "nn_n1"] },
      W(900),
      S("That's the whole loop. Ask me to zoom into backpropagation, or try a worked example!"),
      { op: "focus", ids: ["nn_f"] },
    ],
  },
  {
    title: "How HTTPS works",
    ops: shift([
      S("Here's what happens in the first second when you open a secure website."),
      { op: "frame", id: "ht_f", x: 100, y: 100, w: 1000, h: 640, name: "How HTTPS works" },
      { op: "text", id: "ht_t1", x: 140, y: 130, text: "How HTTPS works", size: "xl" },
      { op: "text", id: "ht_t2", x: 140, y: 190, w: 600, size: "m", text: "Key idea: use slow public-key crypto once to agree on a secret, then fast symmetric encryption for everything else." },
      { op: "shape", id: "ht_c", kind: "rectangle", x: 140, y: 300, w: 200, h: 90, label: "Browser (client)", color: "blue", fill: "semi" },
      { op: "shape", id: "ht_s", kind: "rectangle", x: 840, y: 300, w: 200, h: 90, label: "Website (server)", color: "green", fill: "semi" },
      { op: "focus", ids: ["ht_t1", "ht_c", "ht_s"] },
      W(700),
      S("Step one: the browser says hello and lists the ciphers it supports."),
      { op: "shape", id: "ht_1", kind: "rectangle", x: 440, y: 280, w: 300, h: 56, label: "1. ClientHello: versions, ciphers", color: "light-blue", fill: "semi" },
      { op: "arrow", id: "ht_a1", from: "ht_c", to: "ht_1" },
      { op: "arrow", id: "ht_a2", from: "ht_1", to: "ht_s" },
      S("Step two: the server replies with its certificate — its ID card."),
      { op: "shape", id: "ht_2", kind: "rectangle", x: 440, y: 356, w: 300, h: 56, label: "2. ServerHello + certificate", color: "green", fill: "semi" },
      { op: "arrow", id: "ht_a3", from: "ht_1", to: "ht_2" },
      S("Step three: the browser checks the certificate was signed by a trusted authority."),
      { op: "shape", id: "ht_3", kind: "rectangle", x: 440, y: 432, w: 300, h: 56, label: "3. Verify certificate (CA)", color: "violet", fill: "semi" },
      { op: "arrow", id: "ht_a4", from: "ht_2", to: "ht_3" },
      { op: "focus", ids: ["ht_1", "ht_2", "ht_3"] },
      W(600),
      S("Step four: both sides derive the same secret key without ever sending it openly."),
      { op: "shape", id: "ht_4", kind: "rectangle", x: 440, y: 508, w: 300, h: 56, label: "4. Key exchange → session key", color: "orange", fill: "semi" },
      { op: "arrow", id: "ht_a5", from: "ht_3", to: "ht_4" },
      S("Step five: everything is encrypted. Eavesdroppers only see scrambled bytes."),
      { op: "shape", id: "ht_5", kind: "rectangle", x: 440, y: 584, w: 300, h: 56, label: "5. Encrypted HTTP traffic", color: "light-green", fill: "solid" },
      { op: "arrow", id: "ht_a6", from: "ht_4", to: "ht_5" },
      { op: "svg", id: "ht_lock", x: 140, y: 440, w: 200, h: 160, svg: lockSvg },
      { op: "note", id: "ht_n1", x: 840, y: 440, text: "The padlock means two things: identity verified + traffic encrypted.", color: "yellow" },
      { op: "focus", ids: ["ht_4", "ht_5", "ht_lock", "ht_n1"] },
      W(900),
      S("That's HTTPS! Want me to dive into certificates or the key-exchange math?"),
      { op: "focus", ids: ["ht_f"] },
    ], 1260),
  },
];

/** Stage 1 extras: excerpts Marg lifts off each page while scrolling the PDF. */
export const PAGE_EXCERPTS: CanvasOp[][] = [
  [{ op: "note", id: "pq_1", x: 100, y: -160, color: "light-blue", text: "p.1 Abstract: “explanations beside a selected passage help readers… without losing their place.”" }],
  [{ op: "note", id: "pq_2", x: 340, y: -160, color: "light-blue", text: "p.2 Figure 1: “separate chat 62, inline help 74… no confidence intervals.”" }],
  [{ op: "note", id: "pq_3", x: 580, y: -160, color: "light-blue", text: "p.3 §5: “The fixed order creates a practice or fatigue confound… not randomized.”" }],
];
