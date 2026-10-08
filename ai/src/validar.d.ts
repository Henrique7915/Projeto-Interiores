declare module '*/schema/validar.mjs' {
  export function validateScene(scene: unknown): { valid: boolean; errors: string[]; warnings: string[] }
}
