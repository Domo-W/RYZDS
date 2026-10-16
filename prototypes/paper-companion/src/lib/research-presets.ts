// Independently written, excerpt-scoped adaptations of ideas from the linked
// research-writing collection. These are not copies of its full-paper templates.
export const researchSource =
  "https://github.com/Leey21/awesome-ai-research-writing";
export const researchSourceRevision =
  "df0af726a79109b8760c1b80d5dfc36ed44a6f1f";
export const promptPresets = [
  {
    id: "explain",
    label: "Explain content",
    origin: "Margin original",
    prompt: `Help me understand the selected research passage, equation or diagram.
Start with the main idea in one sentence. Define the essential terms and symbols, then explain the mechanism or reasoning in a few clear steps. Give one small example if it helps, marking it as an illustration rather than a result from the paper. Explain why this idea matters in the supplied context.
Use only the selection and current page for paper-specific claims. Separate the authors' claims from background explanation. If a definition, assumption or equation is missing, tell me exactly what to select next. Keep the explanation concise and cite the supplied page.`,
  },
  {
    id: "logic",
    label: "Check logic",
    origin: "Inspired by Logic checking in the research-writing collection",
    prompt: `Help me evaluate the argument in the selected passage.
Briefly identify its main claim, supporting evidence and necessary assumptions. Check whether the stated conclusion follows, and whether terms change meaning or statements contradict one another. Report only issues that affect understanding or the validity of the argument; do not invent problems or offer cosmetic edits.
For each concern, point to the relevant wording or visual evidence, explain the gap, and name the evidence that would resolve it. Distinguish a demonstrated contradiction from something merely not found in the supplied paper. If no substantive issue is visible, say so within the limits of this excerpt. Check relevant sections of the attached paper before flagging missing context. Keep the response focused on this selection. Cite the supplied page.`,
  },
  {
    id: "results",
    label: "Analyze results",
    origin:
      "Inspired by Experimental analysis in the research-writing collection",
    prompt: `Read the selected figure, table or experimental result with me.
First state the research question this result appears to address. Explain the axes, metrics, units, comparisons and direction of improvement when visible. Identify the strongest supported pattern and any trade-off, exception or ablation insight. Use exact values only when they are legible, and distinguish absolute from relative changes.
Separate observation from interpretation. Do not infer statistical significance, causality or superiority without supporting evidence. Flag missing baselines, uncertainty estimates, conditions or captions as information needed, not proven omissions from the entire study. End with one careful takeaway and one question to check elsewhere in the paper. Cite the supplied page.`,
  },
  {
    id: "review",
    label: "Reviewer lens",
    origin:
      "Inspired by Reviewer perspective in the research-writing collection",
    prompt: `Give a constructive research review of this selection, using the full paper as background and the current page as the focus.
Summarize the local claim and identify a concrete strength if supported. Assess whether the method or evidence described here supports that claim. Consider assumptions, comparison fairness, alternative explanations and what would be needed to reproduce or test it.
Separate an evidenced methodological concern from an unclear explanation and from information outside this excerpt; check the attached paper before calling evidence missing. For each substantive concern, explain why it matters and propose one specific check, clarification or experiment. Avoid generic criticism; say when no issue is evident. End with the most useful next section or figure to inspect. Do not assign an acceptance score or claim to have reviewed the complete paper. Cite the supplied page.`,
  },
  {
    id: "translate",
    label: "Translate",
    origin: "Margin original",
    prompt:
      "Translate the selected content into {{target_language}}. Preserve the meaning, technical terms, mathematical relationships and uncertainty. Keep important technical terms in parentheses in their original language when helpful. Do not add evidence or strengthen the claims. If it is already in the target language, say so and preserve the original meaning. Flag any ambiguous or unreadable content.",
  },
  {
    id: "graph",
    label: "Explain graph",
    origin: "Margin original",
    prompt:
      "Explain the selected graph, figure, diagram or table in plain English. Identify what is being compared or represented. Walk through visible axes, units, labels, colors, symbols and arrows, then explain how to read the most important pattern. Separate what the figure directly shows from an interpretation or hypothesis. Do not invent unreadable numbers or infer causality or statistical significance without evidence. Point out any missing caption or cropped information needed to interpret it. End with a concise takeaway and cite the supplied page.",
  },
  {
    id: "experiment",
    label: "Next experiment",
    origin: "Margin original",
    prompt:
      "Based on the selected claim, propose one focused follow-up experiment. State the research question, testable hypothesis, comparison or control, measurement, and key confound. Explain what result would support or weaken the claim. Mark every proposed detail as a suggestion, not something the authors did. Identify what additional methods context is needed before this experiment could be designed responsibly. Keep it concise.",
  },
  {
    id: "quiz",
    label: "Quiz me",
    origin: "Margin original",
    prompt:
      "Ask me three research comprehension questions about the selection: one about the core idea, one about its assumptions or evidence, and one about a limitation or application. Keep questions answerable from the supplied context, or explicitly label a question as a transfer exercise. Wait for my answers before giving explanations or feedback.",
  },
];
