# Dot Pattern Reasoning Solver

A browser-based abstract reasoning app for **dot pattern** tasks.

## What it does

- Lets you build a 3-frame sequence (A → B → C) on a square dot grid.
- Lets you create 4 answer candidates.
- Predicts the best next frame (D) by scoring rule consistency.
- Explains which rules were detected and how each option ranked.

## Solver rules included

- Dot-count progression (linear and ratio)
- Rotation (90°, 180°, 270°)
- Horizontal and vertical reflection
- Translation (shift vectors)
- Set operations: union, intersection, XOR

## Run locally

Because this app is fully static, you can run it by opening `index.html` directly in a browser.

Or serve it:

```bash
python3 -m http.server 8080
```

Then open: `http://localhost:8080`

## Notes

- This is a heuristic solver (not guaranteed perfect on all puzzle families).
- Best results come from clear, consistent transformation patterns.
