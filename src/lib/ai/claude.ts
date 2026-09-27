import "server-only";
import Anthropic from "@anthropic-ai/sdk";

// Reads ANTHROPIC_API_KEY from the environment.
export const claude = new Anthropic();

/** Sonnet 5 handles rubric writing, CV reading and scoring (see the build plan). */
export const SCREENING_MODEL = "claude-sonnet-5";
