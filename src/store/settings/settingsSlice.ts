import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../index";

export type TypingSpeed = "slow" | "normal" | "fast";

export interface TypingConfig {
  charBurstMin: number;
  charBurstMax: number;
  charNormalMin: number;
  charNormalMax: number;
  sentencePauseMin: number;
  sentencePauseMax: number;
  commaPauseMin: number;
  commaPauseMax: number;
  thinkPauseChance: number;
  initialDelayMin: number;
  initialDelayMax: number;
  minDelay: number;
  typingIndicatorMs: number;
  checklistSpeedMs: number;
  checklistLineDelayMs: number;
  checklistBubbleSpeedMs: number;
  checklistBubbleLineDelayMs: number;
}

export const TYPING_SPEED_CONFIGS: Record<TypingSpeed, TypingConfig> = {
  slow: {
    charBurstMin: 60,
    charBurstMax: 95,
    charNormalMin: 90,
    charNormalMax: 140,
    sentencePauseMin: 550,
    sentencePauseMax: 900,
    commaPauseMin: 250,
    commaPauseMax: 380,
    thinkPauseChance: 0.08,
    initialDelayMin: 180,
    initialDelayMax: 300,
    minDelay: 45,
    typingIndicatorMs: 1400,
    checklistSpeedMs: 40,
    checklistLineDelayMs: 1200,
    checklistBubbleSpeedMs: 100,
    checklistBubbleLineDelayMs: 1500,
  },
  normal: {
    charBurstMin: 40,
    charBurstMax: 65,
    charNormalMin: 60,
    charNormalMax: 100,
    sentencePauseMin: 370,
    sentencePauseMax: 680,
    commaPauseMin: 155,
    commaPauseMax: 270,
    thinkPauseChance: 0.05,
    initialDelayMin: 120,
    initialDelayMax: 200,
    minDelay: 30,
    typingIndicatorMs: 950,
    checklistSpeedMs: 25,
    checklistLineDelayMs: 900,
    checklistBubbleSpeedMs: 75,
    checklistBubbleLineDelayMs: 1200,
  },
  fast: {
    charBurstMin: 12,
    charBurstMax: 22,
    charNormalMin: 18,
    charNormalMax: 35,
    sentencePauseMin: 120,
    sentencePauseMax: 220,
    commaPauseMin: 60,
    commaPauseMax: 100,
    thinkPauseChance: 0.02,
    initialDelayMin: 40,
    initialDelayMax: 80,
    minDelay: 12,
    typingIndicatorMs: 450,
    checklistSpeedMs: 10,
    checklistLineDelayMs: 400,
    checklistBubbleSpeedMs: 30,
    checklistBubbleLineDelayMs: 500,
  },
};

export interface SettingsState {
  typingSpeed: TypingSpeed;
}

const getInitialTypingSpeed = (): TypingSpeed => {
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem("luna_typing_speed");
      if (stored === "slow" || stored === "normal" || stored === "fast") {
        return stored;
      }
    } catch {
      // Ignore storage errors in private browsing/sandboxed iframes
    }
  }
  return "normal";
};

const initialState: SettingsState = {
  typingSpeed: getInitialTypingSpeed(),
};

export const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    setTypingSpeed: (state, action: PayloadAction<TypingSpeed>) => {
      state.typingSpeed = action.payload;
      if (typeof window !== "undefined") {
        try {
          localStorage.setItem("luna_typing_speed", action.payload);
        } catch {
          // Ignore
        }
      }
    },
  },
});

export const { setTypingSpeed } = settingsSlice.actions;

export const selectTypingSpeed = (state: RootState): TypingSpeed =>
  state.settings?.typingSpeed ?? "normal";

export const selectTypingConfig = (state: RootState): TypingConfig => {
  const speed = state.settings?.typingSpeed ?? "normal";
  return TYPING_SPEED_CONFIGS[speed] ?? TYPING_SPEED_CONFIGS.normal;
};

export default settingsSlice.reducer;
