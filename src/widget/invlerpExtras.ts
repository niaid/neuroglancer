// 256 bins in total.  The first and last bin are for values below the lower bound/above the upper
// bound.
export const NUM_HISTOGRAM_BINS_IN_RANGE = 254;
// Hedwig note: this constant is moved out of `widget/invlerp.ts` to avoid circular reference
export const NUM_CDF_LINES = NUM_HISTOGRAM_BINS_IN_RANGE + 1;
