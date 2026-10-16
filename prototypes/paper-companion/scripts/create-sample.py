"""Generate Margin's original, fictional three-page test paper (requires reportlab)."""
from pathlib import Path
from reportlab.pdfgen import canvas
from reportlab.lib.colors import HexColor

out = Path(__file__).resolve().parents[1] / 'public' / 'sample.pdf'
c = canvas.Canvas(str(out), pagesize=(612, 792))
c.setTitle('Reading with Local Explanations - Fictional Demo')

def text(x,y,s,size=11,bold=False):
    c.setFillColor(HexColor('#293e36'));c.setFont('Helvetica-Bold' if bold else 'Helvetica',size);c.drawString(x,y,s)
def page(n, title):
    text(54,746,'MARGIN / FICTIONAL DEMO PAPER',9,True)
    text(54,709,title,21,True)
    c.setStrokeColor(HexColor('#d9dfd5'));c.line(54,687,558,687)
    text(54,34,'Synthetic data for interaction testing. Not a real research study.',9)
    text(548,34,str(n),9)
def lines(y, rows):
    for row in rows: text(54,y,row);y-=19
    return y
page(1,'Reading with Local Explanations')
lines(655,['A fictional study of contextual support during technical reading', '', 'Abstract',
'We explore whether explanations beside a selected passage help readers',
'understand unfamiliar concepts without losing their place in a paper.',
'The example compares an inline explanation with a separate chat panel.',
'The participants, results and procedures below are entirely invented.', '',
'1. Research question',
'Can local explanations improve immediate comprehension while reducing',
'interface switching? Accuracy and time are separate outcomes: a faster',
'answer does not necessarily mean a better understanding.', '',
'2. Working hypothesis',
'A contextual explanation may reduce the effort of finding the relevant',
'passage after reading help. We call this effort context recovery cost.',
'This is a proposed mechanism, not an established causal explanation.', '',
'Reading guide',
'Figure 1 on page 2 reports illustrative means. Page 3 contains the sample',
'size and design limitations needed to interpret that figure responsibly.', '',
'Try selecting context recovery cost and choosing Explain content.',
'Then ask: How many people participated, and can this show causality?'])
c.showPage()
page(2,'Illustrative Results')
lines(655,['3. Immediate comprehension',
'Figure 1 shows synthetic mean scores on a 100-point comprehension quiz.',
'The chart has no confidence intervals or statistical significance tests.'])
c.setStrokeColor(HexColor('#293e36'));c.line(110,325,110,540);c.line(110,325,490,325)
for value in [0,25,50,75,100]:
    y=325+value*2;text(77,y-4,str(value),10);c.line(105,y,110,y)
for x,score,label in [(190,62,'Separate chat'),(360,74,'Inline help')]:
    c.setFillColor(HexColor('#9fb988'));c.rect(x,325,75,score*2,fill=1,stroke=0)
    text(x+23,337+score*2,str(score),12,True);text(x-4,301,label,11)
text(110,558,'Comprehension score (0-100)',11,True)
lines(263,['Figure 1. Synthetic scores: separate chat 62, inline help 74.',
'The difference is 12 percentage points, not a 12 percent relative increase.', '',
'The pattern is consistent with the hypothesis, but the design and sample',
'on page 3 limit what can be inferred. Do not treat invented data as evidence.', '',
'Try box-selecting the figure and its caption, then choose Explain graph.'])
c.showPage()
page(3,'Methods and Limits')
lines(655,['4. Study design (fictional)',
'Twenty-four participants read two technical passages in a fixed order.',
'Every participant used separate chat first and inline help second.',
'Each condition ended with a ten-question immediate comprehension quiz.', '',
'5. Important limitations',
'The fixed order creates a practice or fatigue confound. Passage difficulty',
'could also explain the difference. Conditions were not randomized.',
'No variance estimates, significance tests or delayed retention measures',
'were collected in this synthetic example. The chart alone cannot establish',
'that inline explanations caused the higher score.', '',
'6. A more informative next experiment',
'Randomize condition order and counterbalance passage assignment.',
'Measure accuracy, reading time and a delayed comprehension score.',
'Report uncertainty and analyze the repeated measures appropriately.', '',
'Cross-page test',
'When asking about Figure 1, the reader should be able to reference this',
'page to report 24 participants and the fixed-order confound.',
'If only page 2 is available, those details cannot be recovered reliably.', '',
'License: CC0. This fictional fixture was written for the Margin prototype.'])
c.save()
print(out)
