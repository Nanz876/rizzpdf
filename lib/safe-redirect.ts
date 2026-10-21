/**
 * Accept only same-site paths ("/pricing?checkout=monthly") as a post-auth
 * redirect, so a crafted ?redirect_url= can't bounce users to another site.
 */
export function safeRedirect(url: string | undefined): string | undefined {
  if (!url || !url.startsWith("/") || url.startsWith("//") || url.startsWith("/\\")) return undefined;
  return url;
}
