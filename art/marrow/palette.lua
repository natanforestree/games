-- Marrow's palette: Scorn-like murk (umber, ochre flesh, bone, rust, oily green) plus two glow
-- ramps. Fighter art uses the amber ramp; the game swaps amber -> cyan at load time for the CPU,
-- so no other color may equal an amber or cyan entry.
return {
  void = "#0b0807",
  umber0 = "#150f0c", umber1 = "#21170f", umber2 = "#2f2116", umber3 = "#43301f",
  flesh0 = "#5a3f2a", flesh1 = "#7a5637", flesh2 = "#9c7446", flesh3 = "#c09a5e",
  bone0 = "#6f6452", bone1 = "#9e917a", bone2 = "#cdbf9f", bone3 = "#ece0c2",
  rust0 = "#4a1f14", rust1 = "#7a3320", rust2 = "#a8502c",
  sick0 = "#2e3319", sick1 = "#4d5427", sick2 = "#7b8038", sick3 = "#b3ae4e",
  amber = { "#5c300f", "#a8601e", "#e8a33a", "#ffd98a" },
  cyan = { "#0f4744", "#2a8f8a", "#6fd6d0", "#c9fff6" },
}
