// Presets de clima (como Cozy/Bright/Moody do exemplo): hora do dia + exposição + paleta sugerida.
export const moods = [
  { id: 'cozy', name: { 'pt-BR': 'Aconchegante', en: 'Cozy' }, timeOfDay: '18:30', exposure: 1.05, palette: ['paint/sand-limewash', 'wood/smoked-oak', 'fabric/navy-velvet', 'fabric/rust-wool', 'wood/walnut'] },
  { id: 'bright', name: { 'pt-BR': 'Claro', en: 'Bright' }, timeOfDay: '12:45', exposure: 0.95, palette: ['paint/white-matte', 'wood/light-ash', 'fabric/linen', 'fabric/sage-linen', 'stone/carrara'] },
  { id: 'moody', name: { 'pt-BR': 'Noturno', en: 'Moody' }, timeOfDay: '22:15', exposure: 1.1, palette: ['paint/charcoal', 'wood/ebony', 'leather/cognac', 'metal/brass', 'fabric/charcoal-felt'] },
]
