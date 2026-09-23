// Jeux de caractères, du plus sombre au plus clair.
// Chaque entrée est un niveau de luminosité ; répéter un caractère élargit sa plage.
const charsets = {
  braille: { label: 'Braille', chars: braille },
  ascii: { label: 'ASCII', chars: [...' .:-=+*#%@'] },
  detailed: { label: 'ASCII détaillé', chars: [...' .\'`^",:;Il!i><~+_-?][}{1)(|\\/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$'] },
  blocks: { label: 'Blocs', chars: [' ', '░', '▒', '▓', '█'] },
  dots: { label: 'Points', chars: [' ', '·', '•', '●'] },
  binary: { label: 'Binaire', chars: [' ', '0', '1'] },
}
