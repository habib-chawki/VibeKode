import { handleCopilotRequest } from "@/lib/copilot-runtime";

// CopilotKit's runtime for Lissie; authorization lives in lib/copilot-runtime.ts.
export const GET = handleCopilotRequest;
export const POST = handleCopilotRequest;
export const PATCH = handleCopilotRequest;
export const DELETE = handleCopilotRequest;
