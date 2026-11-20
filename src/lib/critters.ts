export const CRITTERS = {
  panda: { name: '熊猫', icon: '🐼', model: '/models/panda/panda-rigged-v2.glb', pawColor: '#24282d' },
  pig: { name: '小猪', icon: '🐷', model: '/models/pig/pig-rigged.glb', pawColor: '#b46e59' },
  fox: { name: '狐狸', icon: '🦊', model: '/models/fox/fox-rigged.glb', pawColor: '#563629' },
  tiger: { name: '小老虎', icon: '🐯', model: '/models/tiger/tiger-rigged.glb', pawColor: '#613d30' },
  rabbit: { name: '小兔', icon: '🐰', model: '/models/rabbit/rabbit-rigged.glb', pawColor: '#d5ab86' },
} as const;
export type CritterKind = keyof typeof CRITTERS;
export const CRITTER_KINDS = Object.keys(CRITTERS) as CritterKind[];
export function isCritterKind(value: unknown): value is CritterKind {
  return typeof value === 'string' && Object.hasOwn(CRITTERS, value);
}
