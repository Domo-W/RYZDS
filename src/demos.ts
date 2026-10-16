import type { CanvasOp } from "./canvas/ops";

export type Demo = { title: string; ops: CanvasOp[] };

const S = (text: string): CanvasOp => ({ op: "say", text });
const W = (ms: number): CanvasOp => ({ op: "wait", ms });

function networkSvg() {
  const inp = [80, 150, 220], hid = [50, 117, 183, 250], out = [110, 190];
  let lines = "";
  for (const y1 of inp) for (const y2 of hid) lines += `<line x1='60' y1='${y1}' x2='220' y2='${y2}'/>`;
  for (const y1 of hid) for (const y2 of out) lines += `<line x1='220' y1='${y1}' x2='380' y2='${y2}'/>`;
  const circ = (x: number, ys: number[], fill: string) => ys.map((y) => `<circle cx='${x}' cy='${y}' r='16' fill='${fill}' stroke='#fff' stroke-width='3'/>`).join("");
  return `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 440 300'><rect width='440' height='300' rx='14' fill='#f6f7fb'/><g stroke='#b8bdd1' stroke-width='1.5'>${lines}</g>${circ(60, inp, "#4f7df3")}${circ(220, hid, "#8b5cf6")}${circ(380, out, "#f59e0b")}<g font-family='sans-serif' font-size='14' fill='#555' text-anchor='middle'><text x='60' y='32'>Input</text><text x='220' y='22'>Hidden</text><text x='380' y='32'>Output</text></g></svg>`;
}

const lossSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 300 200'><rect width='300' height='200' rx='14' fill='#fff7ed'/><polyline points='40,30 40,170 260,170' fill='none' stroke='#999' stroke-width='2'/><path d='M45,45 C90,60 110,120 150,140 S230,160 255,165' fill='none' stroke='#d97757' stroke-width='5' stroke-linecap='round'/><text x='150' y='192' text-anchor='middle' font-family='sans-serif' font-size='13' fill='#555'>training steps →</text><text x='22' y='100' transform='rotate(-90 22,100)' text-anchor='middle' font-family='sans-serif' font-size='13' fill='#555'>loss</text></svg>`;

const lockSvg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 160'><rect width='200' height='160' rx='14' fill='#fdf2f2'/><path d='M70,75 V55 a30,30 0 0 1 60,0 V75' fill='none' stroke='#555' stroke-width='8' stroke-linecap='round'/><rect x='50' y='75' width='100' height='65' rx='12' fill='#f2b134'/><circle cx='100' cy='103' r='8' fill='#333'/><rect x='97' y='103' width='6' height='20' rx='3' fill='#333'/></svg>`;

function shift(ops: CanvasOp[], dx: number): CanvasOp[] {
  return ops.map((o) => ("x" in o && typeof o.x === "number" ? ({ ...o, x: o.x + dx } as CanvasOp) : o));
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

export const STAGE_NAMES = ["Drawing: how a neural network learns", "Drawing: how HTTPS works", "Cursor: ping a spot & ask"];

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
