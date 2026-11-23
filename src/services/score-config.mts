// Config key `qa.score` (spec 2.11, 3.2): weight overrides per score dimension and the gauge ring
// colour. The colour goes into an SVG attribute, so the schema accepts only a CSS colour form.
import { z } from '../kernel/index.mts';
import { DEFAULT_GAUGE_COLOR } from './score.mts';

/** The CSS named colours (CSS Color Module Level 4), plus `transparent` and `currentcolor`. */
const NAMED_COLORS = new Set(
  (
    'aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue ' +
    'chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey ' +
    'darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray ' +
    'darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen ' +
    'fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki ' +
    'lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen ' +
    'lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime ' +
    'limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue ' +
    'mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive ' +
    'olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum ' +
    'powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver ' +
    'skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white ' +
    'whitesmoke yellow yellowgreen transparent currentcolor'
  ).split(' '),
);

const HEX = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;
const FUNCTIONAL = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(\s*[-+0-9.%a-z\s,/]+\)$/i;

/** True for a hex colour, a functional colour such as `rgb(124 58 237)`, or a CSS named colour. */
export function isCssColor(value: string): boolean {
  const v = value.trim();
  return HEX.test(v) || FUNCTIONAL.test(v) || NAMED_COLORS.has(v.toLowerCase());
}

const weight = z.number().nonnegative();

/** `qa.score`. A weight left out keeps its default; `DEFAULT_SCORE_WEIGHTS` lists them. */
export const scoreConfig = z.object({
  weights: z
    .strictObject({
      findings: weight.optional(),
      console: weight.optional(),
      coverage: weight.optional(),
      evidence: weight.optional(),
      accessibility: weight.optional(),
      performance: weight.optional(),
    })
    .default({}),
  gaugeColor: z
    .string()
    .refine(isCssColor, { message: 'qa.score.gaugeColor must be a CSS colour: #rgb, #rrggbb, rgb(...), hsl(...), oklch(...) or a named colour' })
    .default(DEFAULT_GAUGE_COLOR),
});
export type ScoreConfig = z.infer<typeof scoreConfig>;
