// Icon and color vocabulary for missions and tasks, shared by Convex functions
// (the planner picks from it, storage validates against it) and the platform
// (imported there as '@convex/lib/visuals', which maps names to Lucide icons).

// Lucide icon names. Every name here must have a component in src/lib/visuals.js.
export const ICON_NAMES = [
  'Apple', 'Archive', 'Baby', 'Backpack', 'Bath', 'Battery', 'BedDouble', 'Bike', 'Bolt', 'BookOpen', 'Bot', 'Box',
  'Briefcase', 'Brush', 'Cable', 'Camera', 'Car', 'Carrot', 'ChefHat', 'Coffee', 'Cog', 'Container', 'CookingPot',
  'Cpu', 'Cuboid', 'Dog', 'DoorOpen', 'Drill', 'Droplets', 'Dumbbell', 'Egg', 'Eye', 'Fish', 'Flame', 'FlaskConical',
  'Flower2', 'FoldHorizontal', 'FoldVertical', 'Footprints', 'Forklift', 'Gamepad2', 'Gem', 'Gift', 'Glasses',
  'GlassWater', 'Grab', 'Hammer', 'Hand', 'HandHelping', 'Handshake', 'Headphones', 'Key', 'Keyboard', 'Lamp',
  'Laptop', 'Layers', 'Leaf', 'Lightbulb', 'Mail', 'Microscope', 'Microwave', 'Milk', 'Move', 'Music', 'Package',
  'Paintbrush', 'PaintRoller', 'PawPrint', 'Pencil', 'Pill', 'Pipette', 'Pizza', 'Plug', 'Pointer', 'Printer',
  'Puzzle', 'Recycle', 'Refrigerator', 'Repeat', 'RotateCw', 'Ruler', 'Sandwich', 'Scale', 'ScanBarcode', 'Scissors',
  'Shirt', 'ShoppingBag', 'ShoppingCart', 'Shovel', 'ShowerHead', 'Smartphone', 'Snowflake', 'Sofa', 'Soup',
  'Sparkles', 'SprayCan', 'Sprout', 'Stethoscope', 'Store', 'Syringe', 'Tag', 'Timer', 'Tractor', 'Trash2',
  'TreePine', 'Truck', 'Utensils', 'UtensilsCrossed', 'Video', 'Warehouse', 'WashingMachine', 'Watch', 'Weight',
  'Wheat', 'Wind', 'Wine', 'Wrench',
]

// Tile background/foreground tones (Tailwind hues).
export const TONE_NAMES = ['violet', 'sky', 'amber', 'emerald', 'rose', 'orange', 'blue', 'teal', 'fuchsia', 'lime']

export const isIcon = (s) => ICON_NAMES.includes(s)
export const isTone = (s) => TONE_NAMES.includes(s)
