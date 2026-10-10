import type { AudioControls } from './edit-plan.contract';

/** Keyframes use OUTPUT seconds. Filtering happens locally before adelay. */
export function gainExpression(c: AudioControls, offset: number) {
  const t = `(t+${offset})`;
  let expression = String(c.gain);
  const points = c.automation;
  if (points.length) {
    expression = String(points.at(-1)!.gain);
    for (let i = points.length - 2; i >= 0; i--) {
      const a = points[i],
        b = points[i + 1];
      expression = `if(lt(${t},${b.time}),${a.gain}+(${b.gain}-${a.gain})*(${t}-${a.time})/${b.time - a.time},${expression})`;
    }
    expression = `if(lt(${t},${points[0].time}),${c.gain},${expression})`;
  }
  for (const m of c.mutes)
    expression = `if(gte(${t},${m.start})*lt(${t},${m.end}),0,${expression})`;
  return expression;
}
export function audioFilters(
  c: AudioControls,
  offset: number,
  duration: number,
) {
  return `volume='${gainExpression(c, offset)}':eval=frame${c.fadeIn ? `,afade=t=in:st=0:d=${c.fadeIn}` : ''}${c.fadeOut ? `,afade=t=out:st=${duration - c.fadeOut}:d=${c.fadeOut}` : ''}`;
}
