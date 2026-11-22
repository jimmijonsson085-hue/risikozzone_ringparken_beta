import { DemolitionSourceNode } from '../types/dispersion';

export interface PrioritizedWebGlPlumeSource {
  source: DemolitionSourceNode;
  isSelected: boolean;
}

export function selectWebGlPlumeSources(
  sources: DemolitionSourceNode[],
  selectedSourceId: string | null,
  maxCount: number = 8
): PrioritizedWebGlPlumeSource[] {
  const activeSources = sources.filter((s) => s.active);
  const selectedSrc = selectedSourceId
    ? sources.find((s) => s.id === selectedSourceId)
    : undefined;

  const prioritized = selectedSrc
    ? [selectedSrc, ...activeSources.filter((s) => s.id !== selectedSrc.id)]
    : activeSources.length > 0
    ? activeSources
    : sources.slice(0, 1);

  return prioritized.slice(0, maxCount).map((source) => ({
    source,
    isSelected: selectedSourceId !== null && source.id === selectedSourceId,
  }));
}
