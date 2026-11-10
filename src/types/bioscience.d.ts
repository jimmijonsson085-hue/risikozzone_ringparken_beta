declare module '3dmol' {
  export const rasmolElementColors: Record<string, any>;
  export function createViewer(
    element: HTMLElement | string,
    config?: {
      defaultcolors?: any;
      backgroundColor?: string;
      antialias?: boolean;
      cartoonQuality?: number;
    }
  ): any;
}

declare module 'smiles-drawer' {
  export class Drawer {
    constructor(options?: Record<string, any>);
    draw(
      tree: any,
      target: HTMLCanvasElement | string,
      theme?: string,
      weights?: boolean
    ): void;
  }
  export function parse(
    smiles: string,
    successCallback: (tree: any) => void,
    errorCallback?: (err: any) => void
  ): void;
  const SmilesDrawer: {
    Drawer: typeof Drawer;
    parse: typeof parse;
  };
  export default SmilesDrawer;
}
