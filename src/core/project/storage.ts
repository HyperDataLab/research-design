export const DOC_KINDS = ['papers', 'draft', 'bank'] as const;
export const ITEM_COLLECTIONS = ['paper-models', 'facts'] as const;
export type DocKind = (typeof DOC_KINDS)[number];
export type ItemCollection = (typeof ITEM_COLLECTIONS)[number];
