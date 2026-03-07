# Matrigma Solver (klistra-in + avancerad bildanalys)

Webbapp för att lösa Matrigma-/Raven-liknande matrisuppgifter med kombinerad visuell analys och OCR.

## Funktioner
- Två tydliga steg-rutor:
  - **Steg 1:** klistra in bild för matris/figurer.
  - **Steg 2:** klistra in bild för svarsalternativ.
- Ingen filuppladdning krävs, endast urklipp (`Ctrl/Cmd + V`).
- Interaktiv crop i båda stegen (dra musen för exakt markering).
- Förhandsvisning med kontrast-/pixel-förstärkning så celler och detaljer blir tydligare.
- Stöd för vald matrisstorlek: **3x3, 4x4, 5x5, 6x6**.
- Hybridanalys:
  - **Visuell pipeline** för figurmönster (fyllnad, symmetri, orientering/rotationstendens, komplexitet, komponenter).
  - **OCR-pipeline** för numeriska/textuella mönster.
  - Kombinerar resultaten när båda finns.
- Svar ges endast från upptäckta alternativ i Steg 2.

## Start
Öppna `index.html` i webbläsaren.

## Användning
1. Välj matrisstorlek.
2. Klistra in matrisbild i Steg 1.
3. Dra crop så hela relevanta matrisområdet täcks.
4. Klistra in alternativbild i Steg 2.
5. Dra crop runt hela svarsalternativslistan.
6. Klicka **Kör OCR + Lös**.

## Viktig notering
- Appen är byggd för hög robusthet med både figur- och textanalys, men ingen generell solver kan garantera perfekt träff på exakt alla adaptiva testvarianter utan domänspecifik träningsdata per testplattform.
