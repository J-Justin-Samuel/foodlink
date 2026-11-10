import { Bricolage_Grotesque, Figtree } from "next/font/google";

/** Headings: warm and a little quirky. Body: clean and readable on small screens. */
export const fontDisplay = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--ff-display",
  display: "swap",
});
export const fontBody = Figtree({
  subsets: ["latin"],
  variable: "--ff-body",
  display: "swap",
});
export const fontClasses = `${fontDisplay.variable} ${fontBody.variable} font-sans`;
