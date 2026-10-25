import {
  Apple, Archive, Baby, Backpack, Bath, Battery, BedDouble, Bike, Bolt, BookOpen, Bot, Box, Briefcase, Brush, Cable,
  Camera, Car, Carrot, ChefHat, Coffee, Cog, Container, CookingPot, Cpu, Cuboid, Dog, DoorOpen, Drill, Droplets,
  Dumbbell, Egg, Eye, Fish, Flame, FlaskConical, Flower2, FoldHorizontal, FoldVertical, Footprints, Forklift,
  Gamepad2, Gem, Gift, Glasses, GlassWater, Grab, Hammer, Hand, HandHelping, Handshake, Headphones, Key, Keyboard,
  Lamp, Laptop, Layers, Leaf, Lightbulb, Mail, Microscope, Microwave, Milk, Move, Music, Package, Paintbrush,
  PaintRoller, PawPrint, Pencil, Pill, Pipette, Pizza, Plug, Pointer, Printer, Puzzle, Recycle, Refrigerator, Repeat,
  RotateCw, Ruler, Sandwich, Scale, ScanBarcode, Scissors, Shirt, ShoppingBag, ShoppingCart, Shovel, ShowerHead,
  Smartphone, Snowflake, Sofa, Soup, Sparkles, SprayCan, Sprout, Stethoscope, Store, Syringe, Tag, Timer, Tractor,
  Trash2, TreePine, Truck, Utensils, UtensilsCrossed, Video, Warehouse, WashingMachine, Watch, Weight, Wheat, Wind,
  Wine, Wrench,
} from '@lucide/vue'
import { isIcon, isTone } from '@convex/lib/visuals'

/** Icon components by name: the vocabulary in convex/lib/visuals.js that the mission planner picks from. */
export const ICONS = {
  Apple, Archive, Baby, Backpack, Bath, Battery, BedDouble, Bike, Bolt, BookOpen, Bot, Box, Briefcase, Brush, Cable,
  Camera, Car, Carrot, ChefHat, Coffee, Cog, Container, CookingPot, Cpu, Cuboid, Dog, DoorOpen, Drill, Droplets,
  Dumbbell, Egg, Eye, Fish, Flame, FlaskConical, Flower2, FoldHorizontal, FoldVertical, Footprints, Forklift,
  Gamepad2, Gem, Gift, Glasses, GlassWater, Grab, Hammer, Hand, HandHelping, Handshake, Headphones, Key, Keyboard,
  Lamp, Laptop, Layers, Leaf, Lightbulb, Mail, Microscope, Microwave, Milk, Move, Music, Package, Paintbrush,
  PaintRoller, PawPrint, Pencil, Pill, Pipette, Pizza, Plug, Pointer, Printer, Puzzle, Recycle, Refrigerator, Repeat,
  RotateCw, Ruler, Sandwich, Scale, ScanBarcode, Scissors, Shirt, ShoppingBag, ShoppingCart, Shovel, ShowerHead,
  Smartphone, Snowflake, Sofa, Soup, Sparkles, SprayCan, Sprout, Stethoscope, Store, Syringe, Tag, Timer, Tractor,
  Trash2, TreePine, Truck, Utensils, UtensilsCrossed, Video, Warehouse, WashingMachine, Watch, Weight, Wheat, Wind,
  Wine, Wrench,
}

/**
 * Colored icon tiles for missions and tasks, picked from keywords in the name.
 * Class strings are written out in full so Tailwind can see them.
 */
export const TONES = {
  violet: 'bg-violet-500/12 text-violet-600 dark:text-violet-400',
  sky: 'bg-sky-500/12 text-sky-600 dark:text-sky-400',
  amber: 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
  emerald: 'bg-emerald-500/12 text-emerald-600 dark:text-emerald-400',
  rose: 'bg-rose-500/12 text-rose-600 dark:text-rose-400',
  orange: 'bg-orange-500/12 text-orange-600 dark:text-orange-400',
  blue: 'bg-blue-500/12 text-blue-600 dark:text-blue-400',
  teal: 'bg-teal-500/12 text-teal-600 dark:text-teal-400',
  fuchsia: 'bg-fuchsia-500/12 text-fuchsia-600 dark:text-fuchsia-400',
  lime: 'bg-lime-500/15 text-lime-700 dark:text-lime-400',
}

const TONE_ORDER = Object.keys(TONES)

// First match wins, so specific words come before generic ones.
const RULES = [
  [/sock/i, Footprints, 'fuchsia'],
  [/pick|grasp|lift|grab/i, Grab, 'amber'],
  [/stack|pile/i, Layers, 'orange'],
  [/smooth|wrinkle/i, Wind, 'sky'],
  [/lay .*flat|flatten|spread (?!duvet)/i, Hand, 'emerald'],
  [/trouser|pant|jean/i, FoldVertical, 'blue'],
  [/towel|fitted/i, FoldHorizontal, 'teal'],
  [/fold|shirt|garment|laundry|cloth|hang/i, Shirt, 'violet'],
  [/duvet|sheet|bed|pillow/i, BedDouble, 'rose'],
  [/rinse|wash|wipe|spill|water/i, Droplets, 'blue'],
  [/glass/i, Wine, 'sky'],
  [/cutlery|fork|spoon/i, Utensils, 'amber'],
  [/dish|plate|rack/i, UtensilsCrossed, 'blue'],
  [/sweep|crumb|clean/i, Brush, 'lime'],
  [/kitchen|counter/i, ChefHat, 'orange'],
  [/bag|grocer/i, ShoppingBag, 'emerald'],
  [/open|door|appliance/i, DoorOpen, 'teal'],
  [/heavy/i, Dumbbell, 'orange'],
  [/fragile|egg/i, Egg, 'amber'],
  [/cart/i, ShoppingCart, 'emerald'],
  [/shelf|restock|retail|face product/i, Store, 'violet'],
  [/usb|hdmi|unplug|plug/i, Plug, 'fuchsia'],
  [/cable/i, Cable, 'fuchsia'],
  [/tote|bin|warehouse/i, Package, 'amber'],
  [/approach|inspect|look/i, Eye, 'sky'],
  [/place|reset|put/i, Move, 'emerald'],
  [/manipulat|perform/i, Hand, 'violet'],
  [/box|pack/i, Box, 'orange'],
  [/robot/i, Bot, 'blue'],
  [/sparkle|polish/i, Sparkles, 'lime'],
]

function hashTone(name) {
  let h = 0
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0
  return TONE_ORDER[h % TONE_ORDER.length]
}

/**
 * { icon, tone, color } for a task or mission. A stored `icon`/`tone` (picked by the
 * planner) wins; otherwise both come from keywords in the name. `color` is the tone's
 * solid hue, for chart marks that should match the icon tile.
 */
export function visualFor(name = '', stored = null) {
  const rule = RULES.find(([re]) => re.test(name))
  const [fallbackIcon, fallbackKey] = rule ? [rule[1], rule[2]] : [Video, hashTone(name)]
  const icon = isIcon(stored?.icon) ? ICONS[stored.icon] : fallbackIcon
  const key = isTone(stored?.tone) ? stored.tone : fallbackKey
  return { icon, tone: TONES[key], color: `var(--color-${key}-500)` }
}
