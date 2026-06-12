// Google Publisher Tag (GPT) type declarations
declare namespace googletag {
  interface Slot {
    addService(service: PubAdsService): Slot;
    defineSizeMapping(sizeMapping: SizeMappingArray): Slot;
    getId(): string;
    get(name: string): string | null;
    set(name: string, value: string): Slot;
  }

  interface SizeMappingBuilder {
    addSize(
      viewport: [number, number],
      size: [number, number] | [number, number][]
    ): SizeMappingBuilder;
    build(): SizeMappingArray;
  }

  type SizeMappingArray = Array<{
    viewport: [number, number];
    sizes: [number, number][];
  }>;

  interface PubAdsService {
    // biome-ignore lint/suspicious/noExplicitAny: External GPT library event type
    addEventListener(eventName: string, callback: (event: any) => void): void;
    refresh(slots?: Slot[]): void;
    enableSingleRequest(): void;
    collapseEmptyDivs(collapseBeforeAdFetch?: boolean): void;
    setTargeting(key: string, value: string | string[]): PubAdsService;
  }

  type CollapseDivBehavior = 'DISABLED' | 'BEFORE_FETCH' | 'ON_NO_FILL' | null;

  interface PageSettingsConfig {
    collapseDiv?: CollapseDivBehavior;
    singleRequest?: boolean | null;
    targeting?: Record<string, string | string[] | null> | null;
  }

  interface CommandArray {
    push(fn: () => void): number;
  }

  const cmd: CommandArray;
  function defineSlot(
    path: string,
    sizes: [number, number] | [number, number][],
    id: string
  ): Slot | null;
  function pubads(): PubAdsService;
  function display(id: string): void;
  function destroySlots(slots: Slot[]): boolean;
  function sizeMapping(): SizeMappingBuilder;
  function setConfig(config: PageSettingsConfig): void;
  function enableServices(): void;
}

interface Window {
  googletag: typeof googletag & { cmd: googletag.CommandArray };
}
