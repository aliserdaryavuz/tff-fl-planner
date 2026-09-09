"use client";

import { createContext, useContext } from "react";

/** Dışa aktarma çerçevesinin içinde miyiz? Armalar buna göre gömülü çizilir. */
export const ExportContext = createContext(false);

export function useExporting(): boolean {
  return useContext(ExportContext);
}
