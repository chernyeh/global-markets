import { createContext } from "react";

export const FontScaleCtx = createContext(1);
export const FONT_SCALES = [
  { id:"compact", label:"A", scale:0.85 },
  { id:"normal",  label:"A", scale:1.0  },
  { id:"large",   label:"A", scale:1.2  },
];
