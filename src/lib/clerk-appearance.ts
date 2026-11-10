/** Makes Clerk's sign-in and sign-up cards match the FoodLink glass style. */
export const clerkAppearance = {
  variables: {
    colorPrimary: "#F97316",
    colorText: "#1F2937",
    colorTextOnPrimaryBackground: "#1F2937",
    colorBackground: "#FFFFFF",
    colorInputBackground: "#FFFFFF",
    borderRadius: "0.85rem",
    fontFamily: "var(--ff-body), system-ui, sans-serif",
  },
  elements: {
    rootBox: "w-full",
    card: "w-full !bg-white/80 backdrop-blur-xl border border-white/80 !shadow-[0_20px_50px_-20px_rgba(124,45,18,0.35)] !rounded-3xl",
    headerTitle: "!text-[#166534]",
    formButtonPrimary:
      "!bg-[#F97316] hover:!bg-[#ea6a0c] !font-bold !shadow-none !text-[#1F2937]",
    footerActionLink: "!text-[#166534] font-semibold",
    socialButtonsBlockButton: "!border-black/10",
  },
} as const;
