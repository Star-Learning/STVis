import { create } from 'zustand'

export const useStore = create((set) => ({
  isPlaying: false,
  setIsPlaying: (value) => set({ isPlaying: value }),

  currentFrame: 0,
  setCurrentFrame: (value) =>
    set((state) => ({
      currentFrame: typeof value === 'function' ? value(state.currentFrame) : value,
    })),

  mode: 'gdp_share',
  setMode: (value) => set({ mode: value }),

  config: null,
  setConfig: (value) =>
    set({
      config: value,
      mode: value?.data?.main_metric || value?.data?.modes?.[0] || 'gdp_share',
    }),

  geometry: null,
  setGeometry: (value) => set({ geometry: value }),

  timeseries: null,
  setTimeseries: (value) => set({ timeseries: value }),
}))

export default useStore
