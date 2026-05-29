declare module "d3-hilbert" {
  interface HilbertLayout {
    order(n: number): HilbertLayout;
    canvasWidth(w: number): HilbertLayout;
    simplifyCurves(b: boolean): HilbertLayout;
    layout(range: { start: number; length: number }): void;
    getValAtXY(x: number, y: number): number;
    getXyAtVal(val: number): number[];
  }

  function hilbert(): HilbertLayout;
  export default hilbert;
}
