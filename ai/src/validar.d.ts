declare module '*/schema/validar.mjs' {
  export interface ValidateResult {
    valid: boolean
    errors: string[]
    warnings: string[]
  }
  /** Com `catalog`, avisa sobre móveis e materiais que não existem nele. */
  export function validateScene(scene: unknown, opts?: { catalog?: unknown }): ValidateResult
  export function validateCatalog(catalog: unknown): ValidateResult
}
