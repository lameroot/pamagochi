export interface InteractiveObjectDefinition {
  id: string;
  title: string;
  interactionRadius: number;
  enabled: boolean;
  prompt?: string;
  requiredState?: string;
}
