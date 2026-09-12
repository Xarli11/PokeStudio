/**
 * PokeStudio-owned Spanish technical ability effect text (Phase 1C.2b).
 *
 * Provenance: the mechanics themselves are derived from upstream PokéAPI's
 * English `effect_en` text (docs/engineering/DATA_SOURCES.md) — PokéAPI has
 * never published a Spanish ability effect for any ability (a genuine,
 * total upstream gap, confirmed at 0/313 during ingestion). Every string
 * below is authored/maintained by PokeStudio: a precise technical
 * translation of that same English mechanic (exact percentages, stat
 * stages, HP thresholds, conditions — never invented, never machine-
 * translated, never softened into vague marketing-style prose).
 *
 * Keyed by the ability's stable PokéAPI slug (the same identifier
 * `packages/pokemon-data` normalizes into `ability.slug` — never the
 * display name, which is locale-dependent). The ingestion pipeline never
 * writes to this file and never overwrites it — it only ever writes
 * `effect_en`/the (always-empty, in practice) upstream `effect_es` column;
 * this stays a static, hand-reviewed layer entirely outside the ingestion
 * pipeline, the same "own what differentiates us" boundary CLAUDE.md §5
 * describes. See `apps/web/src/app/[locale]/pokemon/[slug]/page.tsx`
 * for the fallback chain this feeds into (PokeStudio ES → upstream EN →
 * "unavailable" message) and this package's `ability-effects-es.test.ts`
 * for the coverage invariants (no empty/duplicate/orphan entries).
 *
 * A handful of upstream English strings have minor data-quality issues
 * (a stray "eelevate"/"dragonize"/"mega-sol"/"fire-mane"/"rocky-payload"/
 * "sharpness"/"dragons-maw"/"poison-puppeteer" set are very recent/
 * non-mainline abilities with terser upstream text; "cotton-down"'s
 * upstream text is truncated/garbled — translated here as the real,
 * well-documented mechanic instead of the broken fragment, flagged in the
 * session report rather than silently normalized).
 */
export const abilityEffectsEs: Record<string, string> = {
  adaptability:
    'Aumenta el bonificador de ataque por movimientos del mismo tipo (BAMT) de 1,5× a 2×.',
  aerilate:
    'Convierte los movimientos de tipo Normal del portador en movimientos de tipo Volador y aumenta su potencia a 1,3×.',
  aftermath:
    'Inflige al atacante daño equivalente a 1/4 de sus PS máximos si debilita al Pokémon con un movimiento de contacto.',
  'air-lock': 'Anula todos los efectos del clima, pero no impide que el clima exista.',
  analytic:
    'Aumenta la potencia de los movimientos a 1,3× cuando el Pokémon actúa en último lugar.',
  'anger-point': 'Sube el Ataque al máximo (6 niveles) al recibir un golpe crítico.',
  'anger-shell':
    'Cuando los PS del Pokémon bajan de la mitad, reduce su Defensa y Defensa especial, pero sube su Ataque, Ataque especial y Velocidad.',
  anticipation:
    'Al entrar en combate, avisa a los entrenadores si algún rival tiene un movimiento supereficaz, Autodestrucción, Explosión o un movimiento de KO directo.',
  'arena-trap':
    'Impide que los rivales huyan o sean cambiados. No afecta a los Pokémon de tipo Volador ni a los que están en el aire.',
  'armor-tail': 'Impide que el rival use movimientos con prioridad, como Ataque Rápido.',
  'aroma-veil': 'Protege a los aliados de movimientos que afectan su estado mental.',
  'as-one-glastrier': 'Combina los efectos de Nerviosismo y Relincho Gélido.',
  'as-one-spectrier': 'Combina los efectos de Nerviosismo y Relincho Lúgubre.',
  'aura-break':
    'Hace que Aura Oscura y Aura Hada debiliten los movimientos de sus respectivos tipos.',
  'aura-guard': 'El Pokémon recibe la mitad de daño de los movimientos que hacen contacto.',
  'bad-dreams':
    'Al final de cada turno, inflige a los rivales dormidos daño equivalente a 1/8 de sus PS máximos.',
  'ball-fetch':
    'Si el Pokémon no lleva un objeto, recupera la Poké Ball del primer lanzamiento fallido del combate.',
  battery: 'Aumenta a 1,3× la potencia de los movimientos de los Pokémon aliados.',
  'battle-armor': 'Protege contra los golpes críticos.',
  'battle-bond':
    'Transforma a este Pokémon en Greninja Ash al debilitar a un Pokémon rival. La potencia de Shuriken de Agua pasa a 20 y siempre golpea tres veces.',
  'beads-of-ruin': 'Reduce la Defensa especial de todos los Pokémon excepto la suya.',
  'beast-boost':
    'Sube en 1 nivel la estadística más alta de este Pokémon cuando debilita a otro Pokémon.',
  berserk:
    'Sube en 1 nivel el Ataque especial de este Pokémon cada vez que sus PS bajan de la mitad.',
  'big-pecks': 'Protege contra las reducciones de Defensa.',
  blaze:
    'Aumenta a 1,5× el daño de los movimientos de tipo Fuego cuando los PS del Pokémon son 1/3 de los máximos o menos.',
  bulletproof: 'Protege contra los movimientos basados en balas, bolas y bombas.',
  'cheek-pouch': 'Restaura PS al comer una baya, además del efecto propio de la baya.',
  'chilling-neigh': 'Sube el Ataque al debilitar a un Pokémon.',
  chlorophyll: 'Duplica la Velocidad bajo un sol intenso.',
  'clear-body': 'Impide que otros Pokémon reduzcan sus estadísticas.',
  'cloud-nine': 'Anula todos los efectos del clima, pero no impide que el clima exista.',
  'color-change':
    'Cambia de tipo al recibir un movimiento que causa daño, adoptando el tipo de dicho movimiento.',
  comatose: 'Este Pokémon actúa siempre como si estuviera dormido.',
  commander: 'Se mete en la boca de un Dondozo aliado si hay uno en el campo.',
  competitive: 'Sube el Ataque especial en 2 niveles cuando se le reduce alguna estadística.',
  'compound-eyes': 'Aumenta a 1,3× la precisión de los movimientos.',
  contrary:
    'Invierte los cambios de estadísticas: las subidas se convierten en bajadas y viceversa.',
  corrosion: 'Este Pokémon puede envenenar a los Pokémon de tipo Veneno y Acero.',
  costar: 'Copia los cambios de estadísticas de un aliado al entrar en combate.',
  'cotton-down':
    'Al recibir un ataque, esparce motas de algodón y reduce en 1 nivel la Velocidad de todos los Pokémon excepto la suya.',
  'cud-chew':
    'Hace que el Pokémon vuelva a consumir una baya ya utilizada al final del turno siguiente.',
  'curious-medicine':
    'Restablece todos los cambios de estadísticas al entrar en el campo de batalla.',
  'cursed-body':
    'Tiene un 30 % de probabilidad de anular (Anulación) el movimiento que golpee al Pokémon.',
  'cute-charm':
    'Tiene un 30 % de probabilidad de encaprichar al Pokémon atacante si este hace contacto.',
  damp: 'Impide que Autodestrucción, Explosión y Detonación funcionen mientras el Pokémon esté en combate.',
  dancer:
    'Cuando otro Pokémon usa un movimiento de danza, este Pokémon usa el mismo movimiento justo después.',
  'dark-aura':
    'Aumenta a 1,33× la potencia de los movimientos de tipo Siniestro de todos los Pokémon, propios y rivales.',
  'dauntless-shield': 'Sube la Defensa al entrar en combate.',
  dazzling: 'Los Pokémon rivales no pueden usar ataques con prioridad.',
  defeatist:
    'Reduce a la mitad el Ataque y el Ataque especial cuando los PS son el 50 % de los máximos o menos.',
  defiant: 'Sube el Ataque en 2 niveles cuando se le reduce alguna estadística.',
  'delta-stream':
    'Crea una corriente de aire misteriosa que no puede ser sustituida por otro clima y hace que los movimientos nunca sean supereficaces contra los Pokémon de tipo Volador.',
  'desolate-land':
    'Crea un sol extremadamente intenso con todas las propiedades de Día Soleado, que no puede ser sustituido por otro clima, y hace que los movimientos de tipo Agua que causan daño fallen.',
  disguise: 'Evita la primera vez que el Pokémon recibiría daño en combate.',
  download:
    'Al entrar en combate, sube en 1 nivel el Ataque o el Ataque especial, según cuál de las dos defensas del rival sea más baja.',
  dragonize:
    'Los movimientos de tipo Normal del Pokémon pasan a ser de tipo Dragón y su potencia aumenta un 20 %.',
  'dragons-maw': 'Aumenta la potencia de los movimientos de tipo Dragón.',
  drizzle: 'Invoca lluvia indefinida al entrar en combate.',
  drought: 'Invoca un sol intenso indefinido al entrar en combate.',
  'dry-skin':
    'Inflige daño equivalente a 1/8 de los PS máximos cada turno con un sol intenso, pero restaura 1/8 de los PS máximos con lluvia. Aumenta a 1,25× el daño recibido de movimientos de tipo Fuego, pero absorbe los movimientos de tipo Agua, restaurando 1/4 de los PS máximos.',
  'early-bird': 'Hace que el sueño dure la mitad de tiempo.',
  'earth-eater': 'Restaura PS al recibir un movimiento de tipo Tierra, en vez de sufrir daño.',
  eelevate:
    'El Pokémon flota sobre el suelo, lo que lo hace inmune a los movimientos de tipo Tierra y a los efectos de Púas, Púas Tóxicas y Red Viscosa. Cuando debilita a un objetivo con un ataque, su estadística más alta sube 1 nivel.',
  'effect-spore':
    'Tiene un 30 % de probabilidad de causar parálisis, envenenamiento o sueño al Pokémon atacante si este hace contacto.',
  'electric-surge': 'Al entrar en combate, cambia el terreno a Campo Eléctrico.',
  electromorphosis:
    'Al recibir un ataque, duplica la potencia del próximo movimiento de tipo Eléctrico que use.',
  'emergency-exit':
    'Este Pokémon se retira automáticamente del combate cuando sus PS bajan de la mitad.',
  'fairy-aura':
    'Aumenta a 1,33× la potencia de los movimientos de tipo Hada de todos los Pokémon, propios y rivales.',
  filter: 'Reduce en 1/4 el daño recibido de movimientos supereficaces.',
  'fire-mane': 'Aumenta un 50 % la potencia de los movimientos de tipo Fuego del Pokémon.',
  'flame-body':
    'Tiene un 30 % de probabilidad de quemar al Pokémon atacante si este hace contacto.',
  'flare-boost': 'Aumenta el Ataque especial a 1,5× cuando el Pokémon está quemado.',
  'flash-fire':
    'Protege contra los movimientos de tipo Fuego. Una vez bloqueado uno, los propios movimientos de tipo Fuego del Pokémon infligen 1,5× de daño hasta que abandone el combate.',
  'flower-gift':
    'Aumenta a 1,5× el Ataque y la Defensa especial de los Pokémon aliados mientras haya un sol intenso.',
  'flower-veil':
    'Protege a los Pokémon aliados de tipo Planta para que otros Pokémon no puedan reducir sus estadísticas.',
  fluffy:
    'Reduce a la mitad el daño de los movimientos de contacto, pero duplica el de los movimientos de tipo Fuego.',
  forecast: 'Cambia el tipo y la forma de Castform según el clima.',
  forewarn: 'Al entrar en combate, revela el movimiento más potente del rival.',
  'friend-guard': 'Reduce a 0,75× todo el daño directo que reciben los Pokémon aliados.',
  frisk: 'Al entrar en combate, revela el objeto que lleva un rival.',
  'full-metal-body': 'Otros Pokémon no pueden reducir las estadísticas de este Pokémon.',
  'fur-coat': 'Reduce a la mitad el daño de los ataques físicos.',
  'gale-wings': 'Sube en 1 la prioridad de los movimientos de tipo Volador.',
  galvanize:
    'Los movimientos de tipo Normal de este Pokémon pasan a ser de tipo Eléctrico y su potencia aumenta a 1,2×.',
  gluttony:
    'Hace que el Pokémon coma cualquier baya que lleve equipada cuando sus PS bajan a la mitad de los máximos, en lugar de esperar a 1/4.',
  'good-as-gold': 'Da inmunidad a los movimientos de estado.',
  gooey: 'Reduce en 1 nivel la Velocidad del Pokémon atacante si este hace contacto.',
  'gorilla-tactics':
    'Aumenta el Ataque del Pokémon, pero solo le permite usar el primer movimiento que seleccione mientras esté en combate.',
  'grass-pelt': 'Sube la Defensa mientras esté activo el Campo de Hierba.',
  'grassy-surge': 'Al entrar en combate, cambia el terreno a Campo de Hierba.',
  'grim-neigh': 'Sube el Ataque especial al debilitar a un Pokémon.',
  'guard-dog':
    'Sube el Ataque si el Pokémon es intimidado, e impide que sea obligado a cambiar de combate.',
  'gulp-missile':
    'Si un Cramorant con esta habilidad usa Surf o Buceo, atrapa una presa y cambia de forma según sus PS restantes.',
  guts: 'Aumenta el Ataque a 1,5× cuando el Pokémon sufre un problema de estado grave.',
  'hadron-engine':
    'Crea un Campo Eléctrico al entrar en combate y sube el Ataque especial mientras esté activo.',
  harvest:
    'Tiene un 50 % de probabilidad de restaurar una baya ya utilizada al final de cada turno, siempre que el Pokémon no haya llevado ningún objeto equipado entretanto.',
  healer:
    'Tiene un 30 % de probabilidad de curar cualquier problema de estado grave de cada Pokémon aliado adyacente al final de cada turno.',
  heatproof: 'Reduce a la mitad el daño de los movimientos de tipo Fuego y de las quemaduras.',
  'heavy-metal': 'Duplica el peso del Pokémon.',
  'honey-gather': 'El Pokémon puede recoger Miel después del combate.',
  hospitality: 'Al entrar en combate, restaura el 25 % de los PS máximos de un Pokémon aliado.',
  'huge-power': 'Duplica el Ataque en combate.',
  'hunger-switch':
    'Hace que Morpeko cambie de forma cada turno, alternando entre Forma Llena y Forma Hambrienta.',
  hustle: 'Aumenta a 1,5× el daño de los movimientos físicos, pero reduce su precisión a 0,8×.',
  hydration: 'Cura cualquier problema de estado grave al final de cada turno mientras llueve.',
  'hyper-cutter': 'Impide que otros Pokémon reduzcan el Ataque.',
  'ice-body':
    'Restaura 1/16 de los PS máximos al final de cada turno durante granizo. Protege contra el daño del granizo.',
  'ice-face':
    'La cabeza de hielo del Pokémon puede absorber un ataque físico como si fuera un sustituto, pero el ataque también cambia el aspecto del Pokémon. El hielo se restaura cuando nieva.',
  'ice-scales': 'Reduce a la mitad el daño de los movimientos especiales.',
  illuminate: 'Duplica la tasa de encuentros con Pokémon salvajes.',
  illusion:
    'Al salir al combate, adopta la apariencia del último Pokémon consciente del equipo hasta que recibe un movimiento que causa daño.',
  immunity: 'Impide el envenenamiento.',
  imposter: 'Se transforma en el Pokémon rival al entrar en combate.',
  infiltrator: 'Ignora los efectos de Pantalla de Luz, Reflejo y Salvaguarda.',
  'innards-out':
    'Cuando este Pokémon se debilita por el movimiento de un rival, ese rival sufre un daño igual a los PS que le quedaban a este Pokémon.',
  'inner-focus': 'Impide que el Pokémon se amedrente.',
  insomnia: 'Impide el sueño.',
  intimidate: 'Al entrar en combate, reduce en 1 nivel el Ataque de los Pokémon rivales.',
  'intrepid-sword': 'Sube el Ataque al entrar en combate.',
  'iron-barbs':
    'Inflige al Pokémon atacante daño equivalente a 1/8 de sus PS máximos si hace contacto.',
  'iron-fist': 'Aumenta a 1,2× la potencia de los movimientos de puño.',
  justified: 'Sube el Ataque en 1 nivel al recibir daño de un movimiento de tipo Siniestro.',
  'keen-eye': 'Impide que se reduzca la precisión del Pokémon.',
  klutz: 'Impide que el Pokémon use el objeto que lleva equipado durante el combate.',
  'leaf-guard': 'Protege contra los problemas de estado graves mientras haya un sol intenso.',
  levitate: 'Esquiva los movimientos de tipo Tierra.',
  libero: 'Cambia el tipo del Pokémon para que coincida con el del movimiento que acaba de usar.',
  'light-metal': 'Reduce a la mitad el peso del Pokémon.',
  'lightning-rod':
    'Atrae hacia sí los movimientos de tipo Eléctrico dirigidos a un único objetivo, cuando es posible. Absorbe los movimientos de tipo Eléctrico, subiendo el Ataque especial en 1 nivel.',
  limber: 'Impide la parálisis.',
  'lingering-aroma': 'El contacto cambia la habilidad del atacante a Aroma Persistente.',
  'liquid-ooze':
    'Inflige a los rivales que usan movimientos que absorben PS el mismo daño que habrían restaurado.',
  'liquid-voice': 'Los movimientos basados en sonido pasan a ser de tipo Agua.',
  'long-reach': 'Los movimientos de este Pokémon no hacen contacto.',
  'magic-bounce':
    'Refleja hacia el usuario la mayoría de los movimientos que no causan daño directo.',
  'magic-guard': 'Protege contra el daño no causado directamente por un movimiento.',
  magician:
    'Roba el objeto que lleva el objetivo cuando el portador usa un movimiento que causa daño.',
  'magma-armor': 'Impide la congelación.',
  'magnet-pull': 'Impide que los rivales de tipo Acero huyan o sean cambiados.',
  'marvel-scale': 'Aumenta la Defensa a 1,5× cuando el Pokémon sufre un problema de estado grave.',
  'mega-launcher': 'Aumenta a 1,5× la potencia de los movimientos de aura y de pulso.',
  'mega-sol':
    'El Pokémon puede usar sus movimientos como si el clima fuera un sol extremadamente intenso.',
  merciless: 'Los movimientos de este Pokémon son siempre críticos contra objetivos envenenados.',
  mimicry: 'Cambia de tipo según el terreno activo.',
  'minds-eye':
    'El Pokémon ignora los cambios en la evasión de los rivales, su propia precisión no puede reducirse, y sus movimientos de tipo Normal y Lucha pueden golpear a los Pokémon de tipo Fantasma.',
  minus:
    'Aumenta el Ataque especial a 1,5× cuando un Pokémon aliado tiene la habilidad Más o Menos.',
  'mirror-armor': 'Devuelve al causante cualquier efecto que reduzca sus estadísticas.',
  'misty-surge': 'Al entrar en combate, cambia el terreno a Campo de Niebla.',
  'mold-breaker':
    'Ignora las habilidades del objetivo si estas podrían obstaculizar o impedir el movimiento.',
  moody:
    'Al final de cada turno, sube en 2 niveles una estadística al azar y reduce otra en 1 nivel.',
  'motor-drive': 'Absorbe los movimientos de tipo Eléctrico, subiendo la Velocidad en 1 nivel.',
  moxie: 'Sube el Ataque en 1 nivel al debilitar a un Pokémon.',
  multiscale: 'Reduce a la mitad el daño recibido cuando el Pokémon tiene los PS al máximo.',
  multitype: 'Cambia el tipo y la forma de Arceus según la Lámina que lleve equipada.',
  mummy: 'Cambia la habilidad del Pokémon atacante a Momia si este hace contacto.',
  'mycelium-might':
    'Los movimientos de estado actúan siempre en último lugar, pero ignoran la habilidad del rival.',
  'natural-cure': 'Cura cualquier problema de estado grave al ser retirado del combate.',
  neuroforce: 'Aumenta a 1,25× el daño supereficaz infligido.',
  'neutralizing-gas': 'Neutraliza las habilidades de todos los Pokémon en combate.',
  'no-guard':
    'Garantiza que todos los movimientos usados por el Pokémon y contra él acierten siempre.',
  normalize: 'Hace que todos los movimientos del Pokémon actúen como de tipo Normal.',
  oblivious: 'Impide el encaprichamiento y protege contra Atracción.',
  opportunist: 'Copia cualquier subida de estadísticas que consiga el rival.',
  'orichalcum-pulse':
    'Crea un sol intenso al entrar en combate y sube el Ataque mientras esté activo.',
  overcoat: 'Protege contra el daño causado por el clima.',
  overgrow:
    'Aumenta a 1,5× el daño de los movimientos de tipo Planta cuando los PS del Pokémon son 1/3 de los máximos o menos.',
  'own-tempo': 'Impide la confusión.',
  'parental-bond':
    'Permite al portador golpear dos veces con los movimientos que causan daño. El segundo golpe tiene la mitad de potencia.',
  'pastel-veil': 'Impide que el Pokémon y sus aliados sean envenenados.',
  'perish-body':
    'Cuando el Pokémon recibe un movimiento de contacto directo, tanto él como el atacante se debilitarán al cabo de tres turnos, a menos que abandonen el combate antes.',
  pickpocket: 'Roba el objeto que lleva el Pokémon atacante si este hace contacto.',
  pickup:
    'Recoge los objetos usados y lanzados de otros Pokémon durante el combate. También puede recoger un objeto al finalizar el combate.',
  'piercing-drill':
    'Cuando el Pokémon usa movimientos de contacto, puede golpear incluso a los objetivos que se están protegiendo.',
  pixilate:
    'Convierte los movimientos de tipo Normal del portador en movimientos de tipo Hada y aumenta su potencia a 1,3×.',
  plus: 'Aumenta el Ataque especial a 1,5× cuando un Pokémon aliado tiene la habilidad Más o Menos.',
  'poison-heal':
    'Restaura 1/8 de los PS máximos al final de cada turno cuando el Pokémon está envenenado, en lugar de sufrir daño.',
  'poison-point':
    'Tiene un 30 % de probabilidad de envenenar al Pokémon atacante si este hace contacto.',
  'poison-puppeteer':
    'Los Pokémon envenenados por los movimientos de Pecharunt también quedan confundidos.',
  'poison-touch':
    'Tiene un 30 % de probabilidad de envenenar al Pokémon objetivo al hacer contacto con él.',
  'power-construct':
    'Transforma a Zygarde (formas 10 % o 50 %) en su Forma Completa cuando sus PS bajan del 50 % de los máximos.',
  'power-of-alchemy': 'Cuando un Pokémon aliado se debilita, este Pokémon adquiere su habilidad.',
  'power-spot': 'La simple cercanía de este Pokémon potencia los movimientos de los demás.',
  prankster: 'Sube en 1 la prioridad de los movimientos que no causan daño.',
  pressure:
    'Aumenta en 1 el coste de PP de los movimientos que tienen a este Pokémon como objetivo.',
  'primordial-sea':
    'Crea una lluvia torrencial con todas las propiedades de Danza Lluvia, que no puede ser sustituida por otro clima, y hace que los movimientos de tipo Fuego que causan daño fallen.',
  'prism-armor': 'Reduce a 0,75× el daño recibido de movimientos supereficaces.',
  'propeller-tail':
    'Ignora los movimientos y habilidades que atraen movimientos hacia otro objetivo.',
  protean: 'Cambia el tipo del portador para que coincida con el del movimiento que va a usar.',
  protosynthesis:
    'Sube la estadística más alta del Pokémon con un sol intenso, o si lleva equipada Energía Potenciadora.',
  'psychic-surge': 'Al entrar en combate, cambia el terreno a Campo Psíquico.',
  'punk-rock':
    'Aumenta la potencia de los movimientos basados en sonido y reduce a la mitad el daño recibido de ese mismo tipo de movimientos.',
  'pure-power': 'Duplica el Ataque en combate.',
  'purifying-salt':
    'Protege contra los problemas de estado y reduce a la mitad el daño de los movimientos de tipo Fantasma.',
  'quark-drive':
    'Sube la estadística más alta del Pokémon en un Campo Eléctrico, o si lleva equipada Energía Potenciadora.',
  'queenly-majesty': 'Los Pokémon rivales no pueden usar ataques con prioridad.',
  'quick-draw': 'Permite al Pokémon actuar en primer lugar de forma ocasional.',
  'quick-feet': 'Aumenta la Velocidad a 1,5× cuando el Pokémon sufre un problema de estado grave.',
  'rain-dish': 'Restaura 1/16 de los PS máximos al final de cada turno mientras llueve.',
  rattled:
    'Sube la Velocidad en 1 nivel al recibir un movimiento de tipo Siniestro, Fantasma o Bicho.',
  receiver: 'Cuando un Pokémon aliado se debilita, este Pokémon adquiere su habilidad.',
  reckless: 'Aumenta a 1,2× la potencia de los movimientos que causan daño de retroceso.',
  refrigerate:
    'Convierte los movimientos de tipo Normal del portador en movimientos de tipo Hielo y aumenta su potencia a 1,3×.',
  regenerator: 'Restaura 1/3 de los PS máximos al ser retirado del combate.',
  ripen: 'Duplica el efecto de las bayas.',
  rivalry:
    'Aumenta a 1,25× el daño infligido contra Pokémon del mismo sexo, pero lo reduce a 0,75× contra Pokémon del sexo opuesto.',
  'rks-system': 'Cambia el tipo de este Pokémon según el Disco que lleve equipado.',
  'rock-head': 'Protege contra el daño de retroceso.',
  'rocky-payload': 'Aumenta la potencia de los movimientos de tipo Roca.',
  'rough-skin':
    'Inflige al Pokémon atacante daño equivalente a 1/8 de sus PS máximos si hace contacto.',
  'run-away':
    'Garantiza que el Pokémon pueda huir siempre de los combates contra Pokémon salvajes.',
  'sand-force':
    'Aumenta a 1,3× la potencia de los movimientos de tipo Roca, Tierra y Acero durante una tormenta de arena. Protege contra el daño de la tormenta de arena.',
  'sand-rush':
    'Duplica la Velocidad durante una tormenta de arena. Protege contra el daño de la tormenta de arena.',
  'sand-spit': 'Crea una tormenta de arena al recibir un ataque.',
  'sand-stream': 'Invoca una tormenta de arena indefinida al entrar en combate.',
  'sand-veil':
    'Aumenta la evasión a 1,25× durante una tormenta de arena. Protege contra el daño de la tormenta de arena.',
  'sap-sipper': 'Absorbe los movimientos de tipo Planta, subiendo el Ataque en 1 nivel.',
  schooling: 'Wishiwashi adopta la Forma Banco cuando sus PS son el 25 % de los máximos o más.',
  scrappy:
    'Permite que los movimientos de tipo Normal y Lucha del Pokémon golpeen a los Pokémon de tipo Fantasma.',
  'screen-cleaner':
    'Anula los efectos de Pantalla de Luz, Reflejo y Velo Aurora al entrar en combate.',
  'seed-sower': 'Convierte el suelo en Campo de Hierba al recibir un ataque.',
  'serene-grace':
    'Duplica la probabilidad de que ocurran los efectos secundarios de los movimientos.',
  'shadow-shield':
    'Cuando este Pokémon tiene los PS al máximo, el daño normal de los movimientos se reduce a la mitad.',
  'shadow-tag': 'Impide que los rivales huyan o sean cambiados.',
  sharpness: 'Aumenta la potencia de los movimientos cortantes.',
  'shed-skin':
    'Tiene un 33 % de probabilidad de curar cualquier problema de estado grave al final de cada turno.',
  'sheer-force':
    'Aumenta a 1,3× la potencia de los movimientos con efectos secundarios, pero anula dichos efectos secundarios.',
  'shell-armor': 'Protege contra los golpes críticos.',
  'shield-dust': 'Protege contra los efectos secundarios de los movimientos recibidos.',
  'shields-down':
    'Transforma a Minior entre Forma Núcleo y Forma Meteoro. Impide los problemas de estado graves y el sueño mientras esté en Forma Meteoro.',
  simple:
    'Duplica los cambios de estadísticas del Pokémon. Estos cambios duplicados siguen limitados a un máximo de -6 o +6 niveles.',
  'skill-link':
    'Hace que los movimientos que golpean de 2 a 5 veces y Triple Patada alcancen siempre su máximo de golpes.',
  'slow-start':
    'Reduce a la mitad el Ataque y la Velocidad durante cinco turnos tras entrar en combate.',
  'slush-rush': 'Duplica la Velocidad de este Pokémon durante el granizo.',
  sniper: 'Aumenta el daño de los golpes críticos a 3× en lugar de 2×.',
  'snow-cloak':
    'Aumenta la evasión a 1,25× durante el granizo. Protege contra el daño del granizo.',
  'snow-warning': 'Invoca granizo indefinido al entrar en combate.',
  'solar-power':
    'Aumenta el Ataque especial a 1,5×, pero resta 1/8 de los PS máximos al final de cada turno mientras haya un sol intenso.',
  'solid-rock': 'Reduce en 1/4 el daño recibido de movimientos supereficaces.',
  'soul-heart':
    'El Ataque especial de este Pokémon sube 1 nivel cada vez que algún Pokémon se debilita.',
  soundproof: 'Protege contra los movimientos basados en sonido.',
  'speed-boost': 'Sube la Velocidad en 1 nivel al final de cada turno.',
  'spicy-spray': 'Cuando el Pokémon recibe daño de un movimiento, quema al atacante.',
  stakeout:
    'Los movimientos de este Pokémon tienen el doble de potencia contra Pokémon que hayan salido a combate ese mismo turno.',
  stall: 'Hace que el Pokémon actúe en último lugar dentro de su rango de prioridad.',
  stalwart: 'Ignora los movimientos y habilidades que atraen movimientos hacia otro objetivo.',
  stamina: 'Sube la Defensa de este Pokémon en 1 nivel al recibir daño de un movimiento.',
  'stance-change':
    'Cambia a Aegislash a Forma Espada antes de usar un movimiento que causa daño, o a Forma Escudo antes de usar Guardia Real.',
  static: 'Tiene un 30 % de probabilidad de paralizar al Pokémon atacante si este hace contacto.',
  steadfast: 'Sube la Velocidad en 1 nivel al amedrentarse.',
  'steam-engine':
    'Sube drásticamente la Velocidad cuando el Pokémon recibe un movimiento de tipo Fuego o Agua.',
  steelworker: 'Los movimientos de tipo Acero de este Pokémon tienen 1,5× de potencia.',
  'steely-spirit': 'Aumenta la potencia de los movimientos de tipo Acero de los Pokémon aliados.',
  stench: 'Tiene un 10 % de probabilidad de amedrentar al objetivo con cada golpe.',
  'sticky-hold': 'Impide que otros Pokémon le quiten el objeto que lleva equipado.',
  'storm-drain':
    'Atrae hacia sí los movimientos de tipo Agua dirigidos a un único objetivo, cuando es posible. Absorbe los movimientos de tipo Agua, subiendo el Ataque especial en 1 nivel.',
  'strong-jaw': 'Aumenta a 1,5× la potencia de los movimientos de mordisco.',
  sturdy:
    'Impide ser debilitado de un golpe teniendo los PS al máximo, dejando al Pokémon con 1 PS. Protege contra los movimientos de KO directo sin importar los PS.',
  'suction-cups':
    'Impide que otros Pokémon obliguen a este Pokémon a abandonar el combate con sus movimientos.',
  'super-luck': 'Sube en 1 nivel la probabilidad de golpe crítico de los movimientos.',
  'supersweet-syrup':
    'Una vez por combate, cuando un Pokémon con esta habilidad entra en combate, reduce en 1 nivel la evasión de todos los rivales adyacentes.',
  'supreme-overlord':
    'El Ataque y el Ataque especial suben por cada Pokémon del equipo que haya sido derrotado.',
  'surge-surfer': 'Duplica la Velocidad de este Pokémon en un Campo Eléctrico.',
  swarm:
    'Aumenta a 1,5× el daño de los movimientos de tipo Bicho cuando los PS del Pokémon son 1/3 de los máximos o menos.',
  'sweet-veil': 'Impide que los Pokémon aliados se duerman.',
  'swift-swim': 'Duplica la Velocidad mientras llueve.',
  'sword-of-ruin': 'Reduce la Defensa de todos los Pokémon excepto la suya.',
  symbiosis: 'Cede el objeto que lleva el portador a un aliado cuando este consume el suyo.',
  synchronize:
    'Transmite al Pokémon que se lo causó las quemaduras, la parálisis o el envenenamiento sufridos.',
  'tablets-of-ruin': 'Reduce el Ataque de todos los Pokémon excepto la suya.',
  'tangled-feet': 'Duplica la evasión cuando el Pokémon está confuso.',
  'tangling-hair':
    'Cuando este Pokémon recibe daño normal de un movimiento de contacto, la Velocidad del atacante se reduce en 1 nivel.',
  technician: 'Aumenta a 1,5× la potencia de los movimientos con 60 de potencia base o menos.',
  telepathy: 'Protege contra los movimientos que causan daño usados por Pokémon aliados.',
  'tera-shell':
    'Todos los movimientos que causan daño y golpean al Pokémon cuando tiene los PS al máximo dejan de ser muy eficaces.',
  'tera-shift':
    'Cuando Terapagos entra en combate, adopta su Forma Teracristal hasta el final del combate.',
  'teraform-zero':
    'En cuanto Terapagos adopta su Forma Estelar, anula inmediatamente los efectos del clima y del terreno.',
  teravolt:
    'Ignora las habilidades del objetivo si estas podrían obstaculizar o impedir sus movimientos.',
  'thermal-exchange':
    'Sube el Ataque al recibir un movimiento de tipo Fuego. El Pokémon no puede ser quemado.',
  'thick-fat': 'Reduce a la mitad el daño de los movimientos de tipo Fuego y Hielo.',
  'tinted-lens': 'Duplica el daño infligido con movimientos que no son muy eficaces.',
  torrent:
    'Aumenta a 1,5× el daño de los movimientos de tipo Agua cuando los PS del Pokémon son 1/3 de los máximos o menos.',
  'tough-claws': 'Aumenta a 1,33× la potencia de los movimientos que hacen contacto.',
  'toxic-boost': 'Aumenta el Ataque a 1,5× cuando el Pokémon está envenenado.',
  'toxic-chain':
    'Puede causar envenenamiento grave cuando el Pokémon golpea a un rival con un movimiento.',
  'toxic-debris':
    'Esparce púas tóxicas a los pies del equipo rival cuando el Pokémon recibe daño de un movimiento físico.',
  trace: 'Copia la habilidad de un rival al entrar en combate.',
  transistor: 'Aumenta la potencia de los movimientos de tipo Eléctrico.',
  triage: 'Los movimientos de curación de este Pokémon tienen su prioridad aumentada en 3.',
  truant: 'El Pokémon holgazanea y no puede actuar un turno de cada dos.',
  turboblaze:
    'Ignora las habilidades del objetivo si estas podrían obstaculizar o impedir sus movimientos.',
  unaware:
    'Ignora los cambios de estadísticas de otros Pokémon al calcular el daño y la precisión.',
  unburden: 'Duplica la Velocidad al usar o perder el objeto que lleva equipado.',
  unnerve: 'Impide que los Pokémon rivales coman las bayas que llevan equipadas.',
  'unseen-fist':
    'Los movimientos de contacto pueden golpear incluso a través de Protección/Detección.',
  'vessel-of-ruin': 'Reduce el Ataque especial de todos los Pokémon excepto la suya.',
  'victory-star': 'Aumenta a 1,1× la precisión de los movimientos de los Pokémon aliados.',
  'vital-spirit': 'Impide el sueño.',
  'volt-absorb': 'Absorbe los movimientos de tipo Eléctrico, restaurando 1/4 de los PS máximos.',
  'wandering-spirit': 'Intercambia habilidades con el rival si este hace contacto.',
  'water-absorb': 'Absorbe los movimientos de tipo Agua, restaurando 1/4 de los PS máximos.',
  'water-bubble':
    'Reduce a la mitad el daño de los movimientos de tipo Fuego, duplica la potencia de los movimientos de tipo Agua e impide las quemaduras.',
  'water-compaction':
    'Sube la Defensa de este Pokémon en 2 niveles al recibir un movimiento de tipo Agua.',
  'water-veil': 'Impide las quemaduras.',
  'weak-armor':
    'Sube la Velocidad y reduce la Defensa en 1 nivel cada una al recibir un movimiento físico.',
  'well-baked-body':
    'Inmune a los movimientos de tipo Fuego; su Defensa sube drásticamente al recibir uno.',
  'white-smoke': 'Impide que otros Pokémon reduzcan sus estadísticas.',
  'wimp-out': 'Este Pokémon se retira automáticamente del combate cuando sus PS bajan de la mitad.',
  'wind-power':
    'Al recibir un movimiento de viento, duplica la potencia del próximo movimiento de tipo Eléctrico que use.',
  'wind-rider':
    'Da inmunidad a los movimientos de viento y sube el Ataque del Pokémon en 1 nivel al recibir uno.',
  'wonder-guard': 'Protege contra los movimientos que causan daño y que no son supereficaces.',
  'wonder-skin':
    'Reduce la precisión base de los movimientos de estado que recibe a exactamente el 50 %.',
  'zen-mode':
    'Cambia la forma de Darmanitan al final de cada turno según sus PS: Modo Zen por debajo del 50 % de los PS máximos, y Modo Estándar en el resto de casos.',
  'zero-to-hero': 'Se transforma en su Forma Héroe al ser retirado del combate.',
};
