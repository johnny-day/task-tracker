/** Parse JSON `{ error, detail }` from a failed fetch response. */
export async function readApiError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string; detail?: string };
    const parts = [j.error, j.detail].filter(Boolean);
    if (parts.length) return parts.join(" — ");
  } catch {
    /* non-JSON body */
  }
  return `Request failed (${res.status})`;
}
